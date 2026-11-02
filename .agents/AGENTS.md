# Scoped Agent Guide: Governance & Operating Rules (`.agents/`)

This directory houses the foundational rules, architectural manifests, and living status handoffs for the repository.

## Directory Structure

- `rules/`: Authoritative engineering policies and operational invariants.
  - `00-master-manifest.md`: Master architectural decisions, ratified standards, and normalization laws.
  - `02-tech-and-architecture.md`: Full technology stack specifications and module data flows.
  - `08-workflow-environments.md`: The operational SOP for branching, daily chat commands, and release gates.
  - `10-anti-ai-slop-design.md`: Professional UI/UX standards for healthcare data tools.
  - `layout.md`: Layout architecture and 3-panel split screen specification.
- `HANDOFF.md`: The single canonical handoff document recording current project state.

## Rules for Agents Modifying Rules

1. Update authoritative rules **in place**; do not create duplicate or conflicting rules.
2. Changes to operational workflows must preserve the Single-Branch Focus, Two-Tier Branching, and Strict Manual User Control invariants.
