#!/usr/bin/env bun
/**
 * check-rules-sync.ts
 *
 * Automated verification script to detect drift between:
 * 1. Active Code (src/lib/, src/types/)
 * 2. Master Rules (.agents/rules/)
 * 3. Architecture Specifications (docs/spec.md, 01_master_plan_architecture_and_fhir_normalization.md)
 *
 * Usage:
 *   bun scripts/check-rules-sync.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

interface CheckResult {
  category: string;
  name: string;
  passed: boolean;
  message: string;
}

const results: CheckResult[] = [];

function check(category: string, name: string, condition: boolean, message: string) {
  results.push({ category, name, passed: condition, message });
}

function readFile(relPath: string): string {
  const fullPath = join(ROOT, relPath);
  if (!existsSync(fullPath)) return "";
  return readFileSync(fullPath, "utf-8");
}

console.log("\n=======================================================");
console.log("  🔍 GLOBAL FHIR LAB — RULES & CODE SYNC CHECK");
console.log("=======================================================\n");

// 1. Rule Files Existence
const EXPECTED_RULES = [
  "00-master-manifest.md",
  "02-tech-and-architecture.md",
  "08-workflow-environments.md",
  "10-anti-ai-slop-design.md",
  "layout.md",
];

for (const rule of EXPECTED_RULES) {
  const exists = existsSync(join(ROOT, ".agents/rules", rule));
  check("Rule Files", `Rule ${rule} exists`, exists, `File .agents/rules/${rule} wajib tersedia.`);
}

// 2. Package.json Scripts
const pkgJson = readFile("package.json");
check("Package Configuration", "package.json is readable", pkgJson.length > 0, "package.json tidak boleh kosong.");
if (pkgJson) {
  try {
    const pkg = JSON.parse(pkgJson);
    check("Package Scripts", "has 'test' script", Boolean(pkg.scripts?.test), "Script 'test' wajib ada.");
    check("Package Scripts", "has 'build' script", Boolean(pkg.scripts?.build), "Script 'build' wajib ada.");
    check("Package Scripts", "has 'typecheck' script", Boolean(pkg.scripts?.typecheck), "Script 'typecheck' wajib ada.");
  } catch {
    check("Package Scripts", "valid JSON", false, "package.json bukan JSON yang valid.");
  }
}

// 3. Normalizer & Flattener Integrity
const normalizerSrc = readFile("src/lib/fhir-normalizer.ts");
check(
  "FHIR Engine",
  "normalizer exports normalizeSimrsToFhir",
  normalizerSrc.includes("normalizeSimrsToFhir"),
  "fhir-normalizer.ts wajib mengekspor fungsi normalisasi."
);

const flattenerSrc = readFile("src/lib/sql-on-fhir-flattener.ts");
check(
  "SQL-on-FHIR Engine",
  "flattener defines canonical table schemas",
  flattenerSrc.includes("SQL_ON_FHIR_VIEW_DEFINITIONS") && flattenerSrc.includes("flattenDatasetWithSqlOnFhir"),
  "sql-on-fhir-flattener.ts wajib mendefinisikan pemetaan tabel SQL-on-FHIR."
);

// 4. Invariant: Zero Docker in Local Dev
const workflowRule = readFile(".agents/rules/08-workflow-environments.md");
check(
  "Operational Safeguards",
  "Workflow specifies Zero-Docker host development",
  workflowRule.includes("Zero-Docker"),
  "08-workflow-environments.md wajib menegaskan Zero-Docker host development."
);

check(
  "Operational Safeguards",
  "Workflow enforces strict manual push/merge control",
  workflowRule.includes("DILARANG KERAS AUTO-PUSH") && workflowRule.includes("DILARANG KERAS AUTO-MERGE"),
  "08-workflow-environments.md wajib menegaskan larangan auto-push dan auto-merge."
);

// 5. Output Results
let allPassed = true;
const grouped: Record<string, CheckResult[]> = {};

for (const r of results) {
  if (!grouped[r.category]) grouped[r.category] = [];
  grouped[r.category].push(r);
  if (!r.passed) allPassed = false;
}

for (const [category, items] of Object.entries(grouped)) {
  console.log(`📁 ${category}:`);
  for (const item of items) {
    const icon = item.passed ? "  ✅" : "  ❌";
    console.log(`${icon} ${item.name}`);
    if (!item.passed) {
      console.log(`     ⚠️  ${item.message}`);
    }
  }
}

console.log("");
if (allPassed) {
  console.log(`🎉 All ${results.length} rules and code consistency checks PASSED!\n`);
  process.exit(0);
} else {
  console.error(`💥 Rules sync check FAILED. Please reconcile the discrepancies above.\n`);
  process.exit(1);
}
