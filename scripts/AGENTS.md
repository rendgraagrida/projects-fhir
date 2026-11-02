# Scoped Agent Guide: Tooling & Automation (`scripts/`)

This directory contains the operational, verification, and workflow automation tooling for the Global HL7 FHIR Learning Lab repository.

## Scripts Inventory

- `local.ts`: Host Zero-Docker dev runner with port conflict detection and dev process cleanup.
- `local.ps1`: Windows PowerShell entrypoint for `local.ts`.
- `local.sh`: POSIX bash entrypoint for `local.ts`.
- `install-local-cmd.ps1`: Installs the `local` PowerShell command into user profile.
- `ci.ts`: Canonical CI quality gate (structure check, rules check, typecheck, tests, build).
- `ci.test.ts`: Test suite verifying the CI gate runner.
- `sync-branch.ts`: Safe Git branch synchronization preserving commit history and ignored files.
- `create-pr.ts`: Safe Pull Request creator with base branch and precheck validations.
- `task-branch.ts`: Branch helper for isolated task branches.
- `check-repository-structure.ts`: Validates guide line/byte limits and internal markdown links.
- `check-rules-sync.ts`: Verifies consistency between active code and living documentation.

## Operating Rules for Scripts

1. Zero Docker host development; runner executes directly on host using Bun.
2. Invariant verification must fail closed (exit non-zero on any error).
3. Do not auto-push or auto-merge inside any script.
