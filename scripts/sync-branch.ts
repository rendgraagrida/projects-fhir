#!/usr/bin/env bun
/**
 * sync-branch.ts
 *
 * Synchronize the current branch without switching branches or rewriting history.
 * Feature branches use origin/development. Dirty work and existing operations
 * require manual resolution. No automatic stash, install, migration, or push.
 *
 * Usage:
 *   bun scripts/sync-branch.ts [--dry-run]
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

export type SyncRunner = (
  file: string,
  args: string[],
  cwd: string
) => {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
};

export function main(
  argv: string[] = process.argv.slice(2),
  cwd: string = ROOT,
  run?: SyncRunner
): number {
  const env = {
    ...process.env,
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
    GH_PROMPT_DISABLED: "1",
  };

  function command(file: string, args: string[]) {
    if (run) return run(file, args, cwd);
    return spawnSync(file, args, { cwd, env, encoding: "utf8", shell: false });
  }

  function git(...args: string[]) {
    const result = command("git", args);
    if (result.error || result.status !== 0) {
      throw new Error(
        `git ${args.map((a) => JSON.stringify(a)).join(" ")} failed: ${
          result.error?.message || result.stderr.trim() || `exit ${result.status}`
        }`
      );
    }
    return args.includes("-z") ? result.stdout : result.stdout.trim();
  }

  const dryRun = argv.includes("--dry-run");

  console.log("\n=======================================================");
  console.log("  🔄 GLOBAL FHIR LAB — SAFE BRANCH SYNCHRONIZATION");
  console.log("=======================================================\n");

  const branch = git("branch", "--show-current");
  if (!branch) {
    console.error("❌ Detached HEAD terdeteksi. Silakan checkout branch yang valid.");
    return 1;
  }
  console.log(`📌 Branch aktif: ${branch}`);

  // 1. Check for ongoing git operations
  for (const marker of [
    "MERGE_HEAD",
    "CHERRY_PICK_HEAD",
    "REVERT_HEAD",
    "rebase-apply",
    "rebase-merge",
    "sequencer",
    "BISECT_LOG",
  ]) {
    const gitDir = git("rev-parse", "--git-dir");
    if (existsSync(resolve(cwd, gitDir, marker))) {
      console.error(`❌ Operasi Git '${marker}' sedang berlangsung. Selesaikan atau batalkan terlebih dahulu.`);
      return 1;
    }
  }

  // 2. Check for dirty working tree
  const statusPorcelain = git("status", "--porcelain", "--untracked-files=all");
  if (statusPorcelain) {
    console.error("❌ Working tree tidak bersih (uncommitted changes terdeteksi).");
    console.error("   Simpan atau commit perubahan lokal Anda sebelum melakukan sync.");
    return 1;
  }

  // 3. Check remote origin
  let hasOrigin = false;
  try {
    const remotes = git("remote");
    hasOrigin = remotes.split(/\r?\n/).includes("origin");
  } catch {
    hasOrigin = false;
  }

  if (!hasOrigin) {
    console.log("ℹ️  Remote 'origin' belum terkonfigurasi. Melewatkan remote fetch.");
    console.log("✅ Working tree lokal bersih dan siap untuk pengembangan.");
    return 0;
  }

  if (dryRun) {
    console.log("🔍 [DRY RUN] Tree bersih. Siap melakukan fetch dan fast-forward dari origin.");
    return 0;
  }

  try {
    console.log("📥 Mengambil metadata dari remote origin...");
    git("fetch", "origin", "--prune");

    if (branch === "main" || branch === "development") {
      console.log(`⏩ Melakukan fast-forward only untuk branch ${branch}...`);
      git("merge", "--ff-only", `origin/${branch}`);
    } else {
      console.log(`⏩ Mengintegrasikan origin/development ke feature branch ${branch}...`);
      git("merge", "--no-ff", "-m", `Merge origin/development into ${branch}`, "origin/development");
    }
    console.log("✅ Sinkronisasi branch selesai dengan aman!\n");
    return 0;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Gagal melakukan sinkronisasi: ${msg}`);
    return 1;
  }
}

if (import.meta.main) {
  const code = main();
  if (code !== 0) process.exit(code);
}
