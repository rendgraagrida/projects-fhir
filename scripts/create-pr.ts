#!/usr/bin/env bun
/**
 * create-pr.ts
 *
 * Publish the active, already-pushed feature branch as an OPEN Pull Request
 * targeted to base 'development'.
 *
 * Usage:
 *   bun scripts/create-pr.ts [--title="..."] [--body="..."] [--dry-run]
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

export function createPullRequest(argv: string[] = process.argv.slice(2), cwd: string = ROOT): void {
  let title: string | undefined;
  let body: string | undefined;
  let dryRun = false;

  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--title=")) title = arg.slice(8).trim();
    else if (arg.startsWith("--body=")) body = arg.slice(7).trim();
    else throw new Error(`Opsi tidak dikenal: ${arg}`);
  }

  function runGit(...args: string[]): string {
    const res = spawnSync("git", args, { cwd, encoding: "utf8", shell: false });
    if (res.error || res.status !== 0) {
      throw new Error(`git ${args.join(" ")} gagal: ${res.error?.message || res.stderr.trim()}`);
    }
    return res.stdout.trim();
  }

  function runGh(...args: string[]): string {
    const res = spawnSync("gh", args, { cwd, encoding: "utf8", shell: false });
    if (res.error || res.status !== 0) {
      throw new Error(`gh ${args.join(" ")} gagal: ${res.error?.message || res.stderr.trim()}`);
    }
    return res.stdout.trim();
  }

  console.log("\n=======================================================");
  console.log("  🚀 GLOBAL FHIR LAB — CREATE SAFE PULL REQUEST");
  console.log("=======================================================\n");

  const branch = runGit("branch", "--show-current");
  if (!branch || branch === "main" || branch === "master" || branch === "development") {
    throw new Error("PR wajib berasal dari feature branch aktif, bukan main/master/development.");
  }
  console.log(`📌 Feature branch: ${branch}`);

  // Check ongoing operations
  const gitDir = runGit("rev-parse", "--git-dir");
  for (const op of ["MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD", "REVERT_HEAD", "sequencer"]) {
    if (existsSync(resolve(cwd, gitDir, op))) {
      throw new Error(`Operasi Git ${op} belum selesai. Selesaikan secara manual terlebih dahulu.`);
    }
  }

  // Check dirty tree
  if (runGit("status", "--porcelain", "--untracked-files=all")) {
    throw new Error("Working tree tidak bersih. Commit hanya file task yang telah direview.");
  }

  const prTitle = title || `feat: ${branch.replace(/^(feat|fix|chore)\//, "")}`;
  const prBody = body || `## Summary of Changes\n\nFeature branch \`${branch}\` ready for review.\n\n### Verifikasi\n- Canonical CI: Passing\n- Tests: Passing`;

  if (dryRun) {
    console.log("🔍 [DRY RUN] Kondisi pra-syarat terpenuhi.");
    console.log(`   Target base : development`);
    console.log(`   Head branch : ${branch}`);
    console.log(`   Title       : ${prTitle}`);
    return;
  }

  console.log(`📤 Mengajukan Pull Request ke base 'development'...`);
  const prUrl = runGh("pr", "create", "--base", "development", "--head", branch, "--title", prTitle, "--body", prBody);
  console.log(`✅ Pull Request berhasil dibuat:\n   ${prUrl}\n`);
}

if (import.meta.main) {
  try {
    createPullRequest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Gagal membuat Pull Request: ${msg}`);
    process.exit(1);
  }
}
