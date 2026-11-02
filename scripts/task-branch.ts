#!/usr/bin/env bun
/**
 * task-branch.ts
 *
 * Prepare or select an isolated task branch for the active work.
 * Reuses the active feature branch, or explicitly branches from clean development.
 *
 * Usage:
 *   bun scripts/task-branch.ts <branch-name> [--dry-run]
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

type Run = (args: string[], cwd: string) => string;
const execute: Run = (args, cwd) => {
  const res = spawnSync("git", args, { cwd, encoding: "utf8", shell: false });
  if (res.error || res.status !== 0) {
    throw new Error(`Git task branch gagal: ${res.error?.message || res.stderr || res.status}`);
  }
  return res.stdout.trim();
};

export function prepareTaskBranch(
  proposed: string,
  options: { cwd?: string; dryRun?: boolean; newBranch?: boolean; run?: Run } = {}
): string {
  const cwd = options.cwd || ROOT;
  const git = (...args: string[]) => (options.run ?? execute)(args, cwd);
  const current = git("branch", "--show-current");
  if (!current) throw new Error("Task memerlukan branch aktif; detached HEAD ditolak.");

  const assertClean = () => {
    const gitDir = git("rev-parse", "--git-dir");
    for (const marker of [
      "MERGE_HEAD",
      "CHERRY_PICK_HEAD",
      "REVERT_HEAD",
      "rebase-apply",
      "rebase-merge",
      "sequencer",
      "BISECT_LOG",
    ]) {
      if (existsSync(resolve(cwd, gitDir, marker))) {
        throw new Error(`Operasi Git ${marker} belum selesai.`);
      }
    }
    if (git("status", "--porcelain", "--untracked-files=all")) {
      throw new Error("Working tree/index belum bersih; tidak dapat membuat atau beralih branch task.");
    }
  };

  assertClean();

  if (current !== "main" && current !== "development" && current !== "master" && !options.newBranch) {
    return current;
  }

  if (current === "main" || current === "master") {
    // If user is on main/master, require switching to development
    console.log(`ℹ️  Peringatan: Berada di branch '${current}'. Task fitur harus dicabangkan dari 'development'.`);
  }

  git("check-ref-format", "--branch", proposed);
  if (["main", "master", "development"].includes(proposed)) {
    throw new Error("Nama branch task tidak boleh main/master/development.");
  }

  const branches = git("for-each-ref", "--format=%(refname:short)", "refs/heads").split(/\r?\n/);
  if (branches.includes(proposed)) {
    throw new Error(`Branch target '${proposed}' sudah ada. Gunakan nama branch lain atau beralih secara manual.`);
  }

  if (options.dryRun) return proposed;

  git("checkout", "-b", proposed);
  const actual = git("branch", "--show-current");
  if (actual !== proposed) throw new Error("Branch task tidak terkonfirmasi.");
  return actual;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const proposed = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");

  if (!proposed) {
    console.error("Usage: bun scripts/task-branch.ts <branch-name> [--dry-run]");
    process.exit(1);
  }

  try {
    const branch = prepareTaskBranch(proposed, { dryRun });
    console.log(`✅ Task branch siap: ${branch}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Gagal menyiapkan task branch: ${msg}`);
    process.exit(1);
  }
}
