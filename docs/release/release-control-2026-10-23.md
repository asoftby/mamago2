# mamaGo 2.0 — Release Control (baseline 2026-10-23)

> Canonical live control: [Issue #714](https://github.com/asoftby/mamago2/issues/714). This document is an immutable evidence snapshot, not approval to deploy. Previous forensic audit: [repository-audit-2026-10-22.md](../engineering/repository-audit-2026-10-22.md).

## 1. Source-of-truth hierarchy

1. GitHub commit SHA + audited build/image digest for deployed code.
2. Verified actual runtime identity for DEV/PROD (not guessed from branch names).
3. GitHub PR + reviews/checks + migration history.
4. Issue #714: living decisions, linked evidence and release-gate status.
5. Local worktree/stash inventory: candidate changes until reconciled.

Never mark a change deployed merely because PR is merged or a branch is named `main`, `prod`, or `dev`. Each item progresses `IMPLEMENTED → REVIEWED → MERGED → DEPLOYED → VERIFIED`, or `DEFERRED` with owner/risk/issue.

## 2. Observed baseline — 23 October 2026

| Signal | Observed | Qualification |
|---|---|---|
| Open pull requests | 24 | Search snapshot |
| Open issues | 27 | Search snapshot before #714 |
| Merged pull requests since Oct 20 | 56 | GitHub query, not a deployed changelog |
| Local canonical `mamago2-dev` | Clean | Reported by user's git status |
| Registered worktrees | 115 | 110 clean by porcelain, 2 with untracked files, 3 missing directories |
| Stash | 4 | `stash@{2}` legacy route media, `stash@{3}` critical CSS; two `next-env.d.ts` |
| Local untracked files | 3 | `docs/offer-wizard.zip`, two `scripts/dev/tmp-birthday-it-*.ts` files |
| Potentially unique local patch branches | 43 | `git cherry` does not prove code not integrated after squash |

GitHub ref snapshot: `dev` = `1f3ff2b1b53e1cccfbf50003cff10a430259d467`; `main` = `981285332dab88425d04989e1ec22cc0836dc028`.

Compare `main...dev`: `dev` is 3034 commits ahead, 12 behind (diverged); merge base `1e65a15ab5a39d399605b9fd49273739ce9470a2`. **This is not the PROD release delta.**

**PROD actual runtime SHA and image digest: UNKNOWN.** **DEV actual runtime SHA: UNKNOWN.** No PROD SSH, DB, cron, or environment mutation was performed during this audit.

## 3. PROD reconciliation — release blocker until verified

- [ ] Obtain read-only evidence of PROD runtime `gitSha`, image digest, deploy timestamp, workflow/run URL, and source commit.
- [ ] Obtain DEV runtime identity and matching image evidence.
- [ ] Verify provenance of deployed artifacts; do not assume `main` is PROD.
- [ ] From **actual PROD SHA** to proposed deploy SHA, enumerate commits, linked PRs, schema/migrations, config changes, and migration compatibility.
- [ ] Verify DB backup/restoration and safe migration path for #280, #281, and rollback/runbook.
- [ ] Run smoke/E2E on DEV (public events/offers/cross-city, SEO legacy redirects/sitemap, birthday, classes, business Telegram, GSC, Safari auth). Record evidence links.
- [ ] Only after the above, sign off release gate in Issue #714 and separately authorize deployment.

## 4. Release triage matrix

| Priority | Area | GitHub references | Why still open |
|---|---|---|---|
| P0 | Deploy, migration, runtime SHA | #280, #281, #205, #702 | PROD identity and safe migration unverified |
| P0 | SEO, legacy routes, cross-city | #249, #253, #695, PR #712 | #695 draft; HTTP redirects need production-like verification |
| P0 | Public offers | #706, PR #699, #707 | PR merged, public acceptance not demonstrated |
| P0 | Birthday booking | #656, PR #660, #666, #672, #684 | E2E and reconcile older confirmation code |
| P1 | Classes | #658, PR #665/#668/#669/#671 | Older stacked PRs superseded in part; DEV release gate open |
| P1 | Business Telegram | PR #692/#696/#704 | #704 draft, signed webhook QA pending |
| P1 | GSC | #689/#705, PR #708/#709/#713 | Direct API merged, actual DEV sync/credentials unverified |
| P1 | Editor Back navigation | #710, PR #711 | Draft; browser navigation QA |
| P2 | Email, Design, Halloween | PR #566/#569/#571/#697 | Conflicts, visual QA, outdated baselines |
| P2 | Security/CI | #677, #687 | Open advisories and existing lint debt |
| P2 | Repo hygiene | #661, #657, #653 | Old PRs, refs, stash, detached worktrees |
| P2 | Family and My Plan | #616, #489, #502, PR #647 | Feature/release acceptance incomplete |

## 5. Open PR inventory (24)

711, 704, 697, 695, 669, 668, 665, 660, 647, 645, 636, 626, 623, 608, 571, 569, 566, 565, 545, 513, 483, 482, 381, 380.

PR freshness and conflict conclusions must be refreshed against live GitHub heads before merge. Existing older [audit](../engineering/repository-audit-2026-10-22.md) contains detailed classification and PR dependencies; do not overwrite current code with stale worktree files.

## 6. Local WIP preservation

| Source | Observed content | Action |
|---|---|---|
| `stash@{0,1}` | 4-line changes to `next-env.d.ts` each | Verify as generated-only |
| `stash@{2}` | 3 files, +135/-3, legacy route article media backfill | Review vs modern SEO migration |
| `stash@{3}` | 13 files, +26/-345, critical CSS | Benchmark and visual regression review |
| `mamago2-local` | untracked `docs/offer-wizard.zip` | Inspect content |
| `integration-birthday-20261014` | two untracked `tmp-birthday-it` scripts | Inspect safety and test value |
| Three stale worktree registrations | `/private/tmp/mamago-pr583-fix`, `mamago-security-main-20261021`, `mamago-weekly-review-616` | Preserve refs until reachability verified |

No `git reset --hard`, `git clean`, `stash pop`, mass branch deletion, bulk cherry-pick, database changes, or deployment as part of this documentation task.

## 7. Per-item acceptance record template

| Item | Owner | PR/Issue | Code status | Merge SHA | DEV runtime SHA / QA | PROD runtime SHA / QA | Risk | Decision |
|---|---|---|---|---|---|---|---|---|
| Example (do not treat as complete) | TBD | #695 | Draft | — | — | — | SEO redirect | Hold |

Record source URL + timestamp whenever moving an item to `DEPLOYED` or `VERIFIED`. Update [Issue #714](https://github.com/asoftby/mamago2/issues/714) as the operational board and preserve this snapshot for traceability.