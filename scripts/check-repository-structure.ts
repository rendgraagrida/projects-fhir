#!/usr/bin/env bun
/**
 * check-repository-structure.ts
 *
 * Validates repository structure, agent guides, required rules,
 * and internal Markdown links across active documentation.
 *
 * Usage:
 *   bun scripts/check-repository-structure.ts
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

export interface RepositoryIssue {
  file: string;
  target?: string;
  message: string;
}

interface FileLimits {
  maxLines: number;
  maxBytes: number;
}

const REQUIRED_GUIDES: Record<string, FileLimits> = {
  "AGENTS.md": { maxLines: 200, maxBytes: 15 * 1024 },
  ".agents/AGENTS.md": { maxLines: 150, maxBytes: 10 * 1024 },
  ".agents/HANDOFF.md": { maxLines: 200, maxBytes: 15 * 1024 },
  "scripts/AGENTS.md": { maxLines: 150, maxBytes: 10 * 1024 },
};

const REQUIRED_RULES = [
  "00-master-manifest.md",
  "02-tech-and-architecture.md",
  "08-workflow-environments.md",
  "10-anti-ai-slop-design.md",
  "layout.md",
];

export function checkRepository(root: string = ROOT): RepositoryIssue[] {
  const issues: RepositoryIssue[] = [];

  // 1. Check required guides and context limits
  for (const [relPath, limits] of Object.entries(REQUIRED_GUIDES)) {
    const fullPath = join(root, relPath);
    if (!existsSync(fullPath)) {
      issues.push({ file: relPath, message: "Required guide file does not exist" });
      continue;
    }

    try {
      const text = readFileSync(fullPath, "utf-8");
      if (text.trim().length === 0) {
        issues.push({ file: relPath, message: "Guide file is empty" });
        continue;
      }

      const lines = text.split("\n").length;
      if (lines > limits.maxLines) {
        issues.push({
          file: relPath,
          message: `Guide exceeds line limit (${lines} > ${limits.maxLines})`,
        });
      }

      const bytes = Buffer.byteLength(text, "utf-8");
      if (bytes > limits.maxBytes) {
        issues.push({
          file: relPath,
          message: `Guide exceeds byte limit (${bytes} > ${limits.maxBytes})`,
        });
      }
    } catch (err: unknown) {
      issues.push({ file: relPath, message: `Failed to read guide: ${err}` });
    }
  }

  // 2. Check required rules
  const rulesDir = join(root, ".agents/rules");
  if (!existsSync(rulesDir)) {
    issues.push({ file: ".agents/rules", message: "Rules directory does not exist" });
  } else {
    for (const rule of REQUIRED_RULES) {
      const fullPath = join(rulesDir, rule);
      if (!existsSync(fullPath)) {
        issues.push({ file: `.agents/rules/${rule}`, message: `Required rule does not exist: ${rule}` });
      }
    }
  }

  // 3. Scan Markdown links in docs/, .agents/, and root
  const markdownFiles: string[] = [];
  function scanDir(dir: string) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
      if (entry.isDirectory()) {
        scanDir(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        markdownFiles.push(full);
      }
    }
  }

  scanDir(join(root, "docs"));
  scanDir(join(root, ".agents"));
  scanDir(join(root, "scripts"));
  if (existsSync(join(root, "AGENTS.md"))) markdownFiles.push(join(root, "AGENTS.md"));

  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  for (const filePath of markdownFiles) {
    const relFile = relative(root, filePath).replace(/\\/g, "/");
    const content = readFileSync(filePath, "utf-8");
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(content)) !== null) {
      const target = match[2].trim();
      // Skip external links, anchors, mailto
      if (/^(https?:|mailto:|#)/.test(target)) continue;

      const [cleanTarget] = target.split("#");
      if (!cleanTarget) continue;

      const resolvedTarget = resolve(dirname(filePath), cleanTarget);
      if (!existsSync(resolvedTarget)) {
        issues.push({
          file: relFile,
          target: cleanTarget,
          message: `Broken internal Markdown link pointing to non-existent file: ${cleanTarget}`,
        });
      }
    }
  }

  return issues;
}

if (import.meta.main) {
  console.log("\n=======================================================");
  console.log("  🔍 CHECK REPOSITORY STRUCTURE & DOCUMENTATION LINKS");
  console.log("=======================================================\n");

  const issues = checkRepository(ROOT);

  if (issues.length === 0) {
    console.log("✅ Repository structure and all internal documentation links are valid!\n");
    process.exit(0);
  } else {
    console.error(`❌ Ditemukan ${issues.length} masalah struktur repositori:\n`);
    for (const issue of issues) {
      const targetStr = issue.target ? ` -> ${issue.target}` : "";
      console.error(`  - [${issue.file}${targetStr}] ${issue.message}`);
    }
    console.error("");
    process.exit(1);
  }
}
