#!/usr/bin/env bun
/**
 * deploy-prod.ts
 *
 * Production is dispatched strictly through the main-only workflow;
 * dispatch is not deployment proof.
 *
 * Usage:
 *   bun scripts/deploy-prod.ts [--reason="..."] [--dry-run]
 */

import { spawnSync, type SpawnSyncOptionsWithStringEncoding, type SpawnSyncReturns } from "child_process";

export type ProductionRunner = (
  file: string,
  args: string[],
  options: SpawnSyncOptionsWithStringEncoding
) => Pick<SpawnSyncReturns<string>, "status" | "stdout" | "stderr" | "error">;

export function main(
  args = process.argv.slice(2),
  options: { cwd?: string; run?: ProductionRunner; log?: (message: string) => void } = {}
): number {
  const cwd = options.cwd ?? process.cwd();
  const run = options.run ?? spawnSync;
  const log = options.log ?? console.log;

  try {
    let dryRun = false;
    let reason = "Explicit production deployment request";
    const seen = new Set<string>();

    for (const arg of args) {
      const key = arg.split("=", 1)[0]!;
      if (seen.has(key)) throw new Error(`Duplicate argument: ${key}`);
      seen.add(key);

      if (arg === "--dry-run") dryRun = true;
      else if (arg.startsWith("--reason=")) reason = arg.slice("--reason=".length);
      else throw new Error(`Unsupported argument: ${arg}. Production supports only the main workflow dispatch.`);
    }

    if (!reason.trim()) throw new Error("Deployment reason must not be empty.");

    const command = (file: string, argv: string[]) => {
      const result = run(file, argv, {
        cwd,
        encoding: "utf8",
        shell: false,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
      });
      if (result.error || result.status !== 0) {
        throw new Error(`${file} failed: ${result.error?.message ?? result.stderr?.trim() ?? `exit ${result.status}`}`);
      }
      return result.stdout.trim();
    };

    if (command("git", ["branch", "--show-current"]) !== "main") {
      throw new Error("Production dispatch requires the local main branch; no branch switching is performed.");
    }

    if (command("git", ["status", "--porcelain=v1", "--untracked-files=all"])) {
      throw new Error("Working tree/index is dirty; commit or preserve changes manually before dispatch.");
    }

    const sha = command("git", ["rev-parse", "--verify", "HEAD"]);
    if (!/^[0-9a-f]{40}$/.test(sha)) {
      throw new Error("Cannot identify the local main commit.");
    }

    const dispatchArgs = [
      "workflow",
      "run",
      "deploy.yml",
      "--repo",
      "rendgraagrida/projects-fhir",
      "--ref",
      "main",
      "-f",
      `reason=${reason}`,
      "-f",
      `expected_sha=${sha}`,
    ];

    if (dryRun) {
      log(`[dry-run] Would dispatch: gh ${JSON.stringify(dispatchArgs)}. Local SHA: ${sha}`);
      return 0;
    }

    // Rules preflight check
    command(process.execPath, ["--no-env-file", "scripts/check-rules-sync.ts"]);

    const remoteMain = command("gh", [
      "api",
      "repos/rendgraagrida/projects-fhir/git/ref/heads/main",
      "--jq",
      ".object.sha",
    ]);

    if (remoteMain !== sha) {
      throw new Error("Local main differs from GitHub main; refusing an unintended release. No fetch/reset is performed.");
    }

    command("gh", dispatchArgs);
    log("Production workflow dispatch accepted (queued, not deployed). The workflow requires the dispatched main SHA to equal the approved expected_sha. Inspect the matching dispatch in GitHub Actions.");
    return 0;
  } catch (error) {
    log(`Production dispatch refused/failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (import.meta.main) process.exitCode = main();
