#!/usr/bin/env bun
/**
 * ci.ts
 *
 * Global HL7 FHIR Learning Lab — Canonical CI Verification Gate.
 * Runs complete preflight, repository structure validation, rules sync,
 * TypeScript typecheck, test suites, and production build verification.
 *
 * Usage:
 *   bun scripts/ci.ts [--skip-build] [--skip-tests]
 */

import { spawn } from "child_process";
import { resolve } from "path";

const ROOT = resolve(import.meta.dir, "..");

export interface Stage {
  name: string;
  command: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
  status: "PENDING" | "PASSED" | "FAILED" | "SKIPPED";
  durationMs: number;
  error?: string;
}

export function runCommand(
  cmd: string[],
  cwd: string = ROOT,
  env?: Record<string, string | undefined>
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const { promise, resolve: resolveResult } = Promise.withResolvers<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }>();

  const child = spawn(cmd[0], cmd.slice(1), {
    cwd,
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout?.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  child.on("exit", (code) => {
    resolveResult({
      exitCode: code ?? 0,
      stdout,
      stderr,
    });
  });

  child.on("error", (err) => {
    resolveResult({
      exitCode: 1,
      stdout,
      stderr: err.message,
    });
  });

  return promise;
}

export async function runCiGate(argv: string[] = process.argv.slice(2)): Promise<number> {
  const skipBuild = argv.includes("--skip-build");
  const skipTests = argv.includes("--skip-tests");

  console.log("\n==================================================================");
  console.log("  🏥 GLOBAL HL7 FHIR LEARNING LAB — CANONICAL CI QUALITY GATE");
  console.log("==================================================================\n");

  const stages: Stage[] = [
    {
      name: "1. Repository Structure & Link Conformance",
      command: ["bun", "scripts/check-repository-structure.ts"],
      status: "PENDING",
      durationMs: 0,
    },
    {
      name: "2. Master Rules & Living Documents Sync",
      command: ["bun", "scripts/check-rules-sync.ts"],
      status: "PENDING",
      durationMs: 0,
    },
    {
      name: "3. TypeScript Strict Typecheck (tsc --noEmit)",
      command: ["bun", "run", "typecheck"],
      status: "PENDING",
      durationMs: 0,
    },
    {
      name: "4. FHIR R4 & SQL-on-FHIR Conformance Tests (bun test)",
      command: ["bun", "test"],
      status: "PENDING",
      durationMs: 0,
    },
    {
      name: "5. Production SPA & PGlite WASM Build (vite build)",
      command: ["bun", "x", "vite", "build"],
      status: "PENDING",
      durationMs: 0,
    },
  ];

  let overallPassed = true;

  for (const stage of stages) {
    if (skipTests && stage.name.includes("Tests")) {
      stage.status = "SKIPPED";
      console.log(`⏭️  ${stage.name}: SKIPPED`);
      continue;
    }
    if (skipBuild && stage.name.includes("Build")) {
      stage.status = "SKIPPED";
      console.log(`⏭️  ${stage.name}: SKIPPED`);
      continue;
    }

    process.stdout.write(`⏳ Menjalankan: ${stage.name}... `);
    const start = Date.now();
    const result = await runCommand(stage.command);
    stage.durationMs = Date.now() - start;

    if (result.exitCode === 0) {
      stage.status = "PASSED";
      console.log(`✅ PASSED (${stage.durationMs}ms)`);
    } else {
      stage.status = "FAILED";
      stage.error = (result.stderr || result.stdout).trim();
      console.log(`❌ FAILED (${stage.durationMs}ms)`);
      if (stage.error) {
        console.error(`\n--- Error Output (${stage.name}) ---`);
        console.error(stage.error);
        console.error("------------------------------------\n");
      }
      overallPassed = false;
      break; // Fail-closed on first failure
    }
  }

  console.log("\n==================================================================");
  console.log("  📊 RINGKASAN CI QUALITY GATE");
  console.log("==================================================================");
  for (const s of stages) {
    const icon = s.status === "PASSED" ? "✅" : s.status === "FAILED" ? "❌" : s.status === "SKIPPED" ? "⏭️" : "⏳";
    console.log(`  ${icon} [${s.status.padEnd(7)}] ${s.name} (${s.durationMs}ms)`);
  }
  console.log("==================================================================\n");

  if (overallPassed) {
    console.log("🎉 CI GATE PASSED: Seluruh verifikasi kanonikal lolos dengan sempurna!\n");
    return 0;
  } else {
    console.error("💥 CI GATE FAILED: Terdapat tahapan verifikasi yang gagal. Perbaiki sebelum push/PR/merge.\n");
    return 1;
  }
}

if (import.meta.main) {
  runCiGate().then((code) => {
    if (code !== 0) process.exit(code);
  });
}
