# Global HL7 FHIR Learning Lab — Agent Guidelines

Global HL7 FHIR Learning Lab & SIMRS Normalization Sandbox is an interactive healthcare interoperability learning platform and normalization simulator that transforms diverse Indonesian SIMRS hospital data into standard HL7 FHIR R4 and SQL-on-FHIR v2 analytical schemas using in-browser PostgreSQL (PGlite WASM).

## Repository Layout

- `src/`: Frontend Single Page Application built with Vite, React 18, TypeScript, Tailwind CSS, Zustand, @xyflow/react, and PGlite (in-browser WASM Postgres).
  - `src/components/`: Interactive panels (LeftCurriculumPanel, CenterSandboxPanel, RightInspectorPanel, StatusBadge).
  - `src/data/`: Curriculum modules (12 pedagogical lessons) and SIMRS normalization seed datasets.
  - `src/lib/`: Core engines (PGlite DB, SQL-on-FHIR flattener, FHIR normalizer, FHIR validator).
  - `src/store/`: Zustand state management for curriculum and sandbox.
  - `src/types/`: Global HL7 FHIR R4 TypeScript contracts and schemas.
- `tests/`: Unit and integration test suites executed with Bun test runner.
- `scripts/`: Operational, verification, and workflow automation tooling executed via Bun from root.
- `.agents/`: Agent operating rules (`rules/`), status handoffs (`HANDOFF.md`), and guidelines.
- `docs/`: Conformance specifications (`spec.md`), master documentation hub, and visual workflow flowchart.

## Agent Context & Read Order

To conserve context window and maintain focus, follow this strict hierarchical read order:

1. **Root Guide**: Read this file (`AGENTS.md`) for general policies and boundaries.
2. **Current Status**: Read `.agents/HANDOFF.md` for active focus, recent test results, and known blockers.
3. **Specific Rules**: Open only the specific rule from `.agents/rules/` relevant to the active task:
   - Workflow & branching: `.agents/rules/08-workflow-environments.md`
   - Architecture & standards: `.agents/rules/00-master-manifest.md`
   - Tech stack: `.agents/rules/02-tech-and-architecture.md`
   - UI/UX & design: `.agents/rules/10-anti-ai-slop-design.md`, `.agents/rules/layout.md`

*Guardrail:* Never auto-load all documents into memory. Scoped guides add detail but never loosen root safeguards.

## Task Navigation Matrix

| Domain / Task | Primary Guide | Key Rules & References |
| :--- | :--- | :--- |
| Workflow, Git, Releases | `AGENTS.md` | `.agents/rules/08-workflow-environments.md`, `scripts/README.md`, `docs/workflow-flowchart.html` |
| FHIR Standards & Normalization | `.agents/rules/00-master-manifest.md` | `docs/spec.md`, `src/lib/fhir-normalizer.ts`, `src/lib/fhir-validator.ts` |
| SQL-on-FHIR v2 & PGlite | `.agents/rules/02-tech-and-architecture.md` | `src/lib/sql-on-fhir-flattener.ts`, `src/lib/pglite-db.ts` |
| UI, 3-Panel Layout & Themes | `.agents/rules/layout.md` | `.agents/rules/10-anti-ai-slop-design.md`, `src/components/`, `src/styles/` |
| Curriculum & SIMRS Datasets | `.agents/rules/00-master-manifest.md` | `src/data/curriculum-modules.ts`, `src/data/simrs-normalization-seeds.ts` |
| Tooling & CI Verification | `scripts/AGENTS.md` | `scripts/README.md`, `.github/workflows/ci-gate.yml` |

## Command Ownership & Daily Workflow

Daily user commands express intent under the single [Rules08 operational SOP](.agents/rules/08-workflow-environments.md); see [scripts/README.md](scripts/README.md) for direct tooling implementations and side effects.

| Chat Command | Direct Entrypoint / Responsibility |
| :--- | :--- |
| `local` | Starts Zero-Docker local host dev runner: `bun scripts/local.ts` or `.\scripts\local.ps1`. |
| `task <nama>` | Prepares or switches to an isolated task branch: `feat/...`, `fix/...`, `chore/...`. |
| `sync` | Preserves branch history safely: `bun scripts/sync-branch.ts`. |
| `push` | Explicitly authorized publication of the current branch; no PR or deploy implied. |
| `pr` | Publishes the already-pushed feature PR: `bun scripts/create-pr.ts`. |
| `merge [PR]` | Merges one reviewed feature PR into development after canonical CI SUCCESS. |
| `merge main` | Separate release promotion PR: development → main. |
| `deploy` | Updates development/staging integration target. |
| `deploy prod` | Production release dispatch. |
| `audit` | Comprehensive verification of FHIR standards, code quality, and repository health. |

## Strict Operational Safeguards

1. **Protected Branches & Preserved History**: No direct push to `main` or `development`. Feature branches originate from `development` and merge back via reviewed PRs. Never rewrite shared published history or overwrite a teammate's checkout.
2. **Explicit User Control for Remote Actions**:
   - **DILARANG KERAS AUTO-PUSH**: Never run `git push` automatically without the explicit command `push` from the user.
   - **DILARANG KERAS AUTO-MERGE**: Never merge PRs automatically without the explicit command `merge` from the user.
3. **Zero-Docker Host Development**: Run directly on host with Bun runtime. PGlite executes PostgreSQL directly in-process via WebAssembly (WASM). Do not spin up Docker containers for local development.
4. **Synthetic Healthcare Data & Privacy**: Strictly synthetic patient records and simulated SIMRS databases. Zero real Protected Health Information (PHI) or hardcoded credentials.
5. **Evidence-First Verification**: Report only commands actually exercised and their observable limits. Prechecks must pass (`bun scripts/ci.ts`) before requesting PR or merge.
