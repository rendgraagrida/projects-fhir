# Repository Tooling & Automation (`scripts/`)

This directory contains the operational, verification, branch synchronization, and local host runner scripts for the Global HL7 FHIR Learning Lab repository. All scripts are executed from the repository root using the Bun runtime.

Agent policies for tooling are defined in [`AGENTS.md`](AGENTS.md) and [Rules08](../.agents/rules/08-workflow-environments.md).

## Development and Release Entry Points

Daily chat commands express intent under the single [Rules08 operational SOP](../.agents/rules/08-workflow-environments.md); this table inventories direct Bun TypeScript implementations and side effects.

| Chat Command | Direct Responsibility / Entrypoint |
| :--- | :--- |
| `local` | Starts local host development runner: `bun scripts/local.ts`, `.\scripts\local.ps1`, or PowerShell profile shortcut. |
| `task <nama>` | Prepares an isolated task branch: `bun scripts/task-branch.ts <nama>`. |
| `sync` | Preserves branch history safely: `bun scripts/sync-branch.ts`. |
| `push` | Explicitly authorized publication of the current branch; no PR or deploy implied. |
| `pr` | Publishes the already-pushed feature PR: `bun scripts/create-pr.ts`. |
| `merge [PR]` | Merges one reviewed feature PR into `development` after canonical CI SUCCESS. |
| `merge main` | Separate release promotion PR: `development` → `main`. |
| `deploy` | Updates development/staging integration target. |
| `deploy prod` | Dispatches production release workflow. |
| `audit` | Evaluates standards conformance, code quality, and repo health. |

## Tooling Inventory

### 1. Read-Only Verification (Safe Offline Tools)

These source validators do not invoke remote operations or alter Git state:

| Script | Purpose | Execution Command |
| :--- | :--- | :--- |
| `ci.ts` | Canonical CI verification gate: runs repo check, rules check, typecheck, tests, and build. | `bun scripts/ci.ts` |
| `check-rules-sync.ts` | Validates consistency between active code, schemas, and master rules. | `bun scripts/check-rules-sync.ts` |
| `check-repository-structure.ts` | Validates guide existence, byte/line limits, and internal Markdown links. | `bun scripts/check-repository-structure.ts` |

### 2. Git & Branch Synchronization (Local Mutating)

| Script | Purpose | Execution Command | Preconditions & Safety |
| :--- | :--- | :--- | :--- |
| `sync-branch.ts` | Fast-forwards same-branch remote updates, then safely merges `origin/development`. | `bun scripts/sync-branch.ts`<br>`bun scripts/sync-branch.ts --dry-run` | Refuses dirty tree, in-progress git operations, or collisions with local ignored files. Never force-pushes or auto-stashes. |
| `create-pr.ts` | Publishes active pushed feature branch as OPEN Pull Request to base `development`. | `bun scripts/create-pr.ts`<br>`bun scripts/create-pr.ts --dry-run` | Requires clean tree, matching pushed HEAD, and passing local prechecks. Never auto-pushes. |
| `task-branch.ts` | Prepares an isolated `feat/...` branch from `development`. | `bun scripts/task-branch.ts <name>` | Requires clean working tree; rejects branching directly from `main`. |

### 3. Local Host Development Runner (Zero-Docker)

| Script | Purpose | Execution Command |
| :--- | :--- | :--- |
| `local.ts` | Scans port 5173, cleans up dev zombie processes, and launches Vite dev server directly on host Bun. | `bun scripts/local.ts` |
| `local.ps1` | Windows PowerShell wrapper for `local.ts`. | `.\scripts\local.ps1` |
| `local.sh` | POSIX bash wrapper for `local.ts`. | `./scripts/local.sh` |
| `install-local-cmd.ps1` | Installs the `local` function into PowerShell `$PROFILE` for global terminal access. | `powershell -ExecutionPolicy Bypass -File scripts/install-local-cmd.ps1` |
