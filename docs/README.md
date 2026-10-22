# Documentation index

This folder holds project documentation. Runtime code lives under `src/`.

## Start here

- [Contributor rules](../CLAUDE.md) and [agent workflow](../AGENTS.md)
- [One-command task workflow](engineering/one-command-task-workflow.md)
- [DEV → PROD readiness](release/dev-to-prod-checklist.md)
- [Deployment and rollback](release/task15-deployment-rollback-runbook.md)
- [Migration release checklist](migration/prelaunch-checklist.md)
- [Engineering backlog](engineering/backlog.md)
- [Repository audit and PR/Issue triage, 22 October 2026](engineering/repository-audit-2026-10-22.md)

- [SEO recovery audit and release checks, 22 October 2026](seo/seo-recovery-audit-2026-10-22.md)

## Layout

| Path | Purpose |
|------|---------|
| **`archive/root-md/`** | Former **root-level** working and session notes (`*.md`) moved here to keep the repository root small. Filenames are unchanged. |
| **`ai-reports/`** | Historical AI / implementation session reports (grouped by area: admin, place, geo, etc.). |
| **`reports/`** | Phase and feature completion write-ups. |
| **`admin/`** | Admin-related documentation. |
| Root of **`docs/`** | Mixed guides, policies, and feature notes (e.g. auth, events, ownership). See also `canonical.md`, `design-system.md`, `data-policy.md` where present. |

## Root `README.md`

The repository root contains the application README, agent/product instructions,
operational configuration and historical implementation reports. Some older notes
already live in **`docs/archive/root-md/`**, **`docs/ai-reports/`** and
**`docs/reports/`**; other reports still remain at the root. A completion report is
historical evidence, not proof of current deployment or release readiness.

Before archiving a remaining root report, check its purpose, inbound links,
imports and build/CI/deploy consumers. Record the source revision and destination,
repair links and verify the move in a small topical PR. Keep runtime scripts,
configuration and Prisma migration history unless a separate review proves a
change safe. See the audit for the per-file cleanup checklist and PR #685 scope.
