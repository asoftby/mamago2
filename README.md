# mamaGo 2.0 — Family OS

mamaGo is a family-oriented product for discovering children's activities and places, planning family time, and coordinating schedules, bookings, and trusted family helpers.

The platform has a public experience, a family workspace (“Мой план”), and separate business and administrative interfaces. **This repository is an active product codebase; documentation and APIs may evolve before release.**

## Technology

- Next.js 16 (App Router), React, TypeScript, Tailwind CSS
- PostgreSQL and Prisma
- Node.js 22 and pnpm 10.28.2
- Containerized deployment via Docker and GitHub Actions

## Start here

| Topic | Source of truth |
| --- | --- |
| Contributor and agent rules | [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md) |
| Product direction | [NORTH_STAR.md](NORTH_STAR.md) |
| Technical documentation | [docs/](docs/) |
| DEV → PROD release readiness | [docs/release/dev-to-prod-checklist.md](docs/release/dev-to-prod-checklist.md) |
| Deployment and rollback | [docs/release/task15-deployment-rollback-runbook.md](docs/release/task15-deployment-rollback-runbook.md) |
| Engineering backlog | [docs/engineering/backlog.md](docs/engineering/backlog.md) |
| Issues and work items | [GitHub Issues](https://github.com/asoftby/mamago2/issues) |
| Code reviews | [Pull requests](https://github.com/asoftby/mamago2/pulls) |

## Local development

Use **Node.js 22** and **pnpm 10.28.2**. Configure your local environment using [`.env.example`](.env.example). Never commit populated `.env` files, credentials, tokens, or production data.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Local development uses host-based routing. Add to `/etc/hosts`:

```text
127.0.0.1 mamago.local
127.0.0.1 business.mamago.local
127.0.0.1 admin.mamago.local
```

| Interface | Local address |
| --- | --- |
| Public | http://mamago.local:3000 |
| Business | http://business.mamago.local:3000 |
| Admin | http://admin.mamago.local:3000 |

`localhost:3000` is a legacy compatibility fallback, not the canonical application origin. For webhooks, use an authorized tunnel with the correct public callback URL.

### Checks

```bash
pnpm lint
pnpm check:push
```

`check:push` runs the project verification gate (typecheck, regression tests and production build). It can be resource-intensive.

Some regression checks read PostgreSQL. Use a dedicated local test database with
synthetic data; never use DEV/PROD credentials or dumps for local verification.
See the [repository audit](docs/engineering/repository-audit-2026-10-22.md) for
verification prerequisites and the existing ESLint baseline.

## Branches and contributions

- **`dev`** is the canonical integration branch. New work uses an isolated task branch and pull request; do not implement directly on `dev`.
- **`main`** is the repository default branch and is not a substitute for a verified deployment artifact. The two branches may intentionally differ.
- Before coding or merging, follow the freshness, worktree, review, and verification rules in [CLAUDE.md](CLAUDE.md).
- The [PR template](.github/pull_request_template.md) covers scope, tests, data compatibility, risks, and rollback.
- Do not merge draft, conflicting, or unverified changes merely to reduce the open-PR count.

## Deployment safety

Deployment uses verified Git revisions and immutable Docker image identities. GitHub branch merges **do not by themselves prove that DEV or PROD is running the new code**. Follow the [release checklist](docs/release/dev-to-prod-checklist.md) and [deployment/rollback runbook](docs/release/task15-deployment-rollback-runbook.md).

Database migration, seeding, bootstrap, and production configuration are **operator-controlled procedures**, not routine local setup. Never run them against a live database without the approved release procedure, backup, and rollback plan.

## Security

Report security issues privately to the repository maintainers; do not publish credentials or exploit details in public issues. Review dependency advisories, but do not dismiss vulnerabilities solely to reach a zero alert count.
