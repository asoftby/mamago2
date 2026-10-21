# Repository audit — 22 October 2026 (Europe/Minsk)

## Scope and reproducibility

Initial inventory: **23 open PRs and 20 open Issues**. Read-only clone; session-start gate PASS at `f174879ab39a345f8f4870177dddede849cb43cc`; isolated task branch/worktree created by task-start.sh. During audit another session merged #684 as `1dbb4f654b8f5302cdcf3ccaa9e45b3a4882fda2`; task-sync.sh reconciled this base and regenerated only the local Prisma client. This audit did not perform that merge or validate its DEV rollout.

The [machine-readable snapshot](repository-audit-2026-10-22.json) preserves exact PR SHAs, dev comparisons, check links and unique paths. Local `git merge-tree --write-tree origin/dev <head>` checked all 23 PR heads without modifying any branch. GraphQL enumerated unresolved review threads; no pagination remained for the open PR list or threads. GitHub per-PR files were cross-checked against local Git: #571 has **203 files**, not 100. Historical green checks are head-specific and do not certify a merge with current dev. `SUPERSEDED` describes code overlap, not completed release QA.

## PR decisions

| PR | Class | Ahead / behind dev | Conflict into dev | Review threads | Evidence / next action |
|---|---|---:|---|---:|---|
| [#685](https://github.com/asoftby/mamago2/pull/685) | NEEDS_REBASE | 5 / 8 | No | 0 | README + four compiler dumps only; no references found by full local rg scan. Merge tree clean, but refresh against dev and run mandatory check:push before merge. Do not duplicate README/deletions. |
| [#684](https://github.com/asoftby/mamago2/pull/684) | EXTERNALLY_MERGED | 0 / 8 | No | n/a | External actor merged during audit as 1dbb4f654b8f5302cdcf3ccaa9e45b3a4882fda2. Initial review: migration and prepaid/auto-confirm changes; DEV and real DB gates were incomplete. This session did not merge it or certify rollout. |
| [#669](https://github.com/asoftby/mamago2/pull/669) | SUPERSEDED | 4 / 64 | No | 0 | 8/9 cumulative changed paths identical to dev; remaining reserveSlot SQL uses now() instead of current explicit UTC conversion. Preserve newer UTC fix. Child ACL/snapshot exists in dev via 5e6ea7d8. Retain draft until #658 evidence is reconciled. |
| [#668](https://github.com/asoftby/mamago2/pull/668) | SUPERSEDED | 3 / 64 | Yes | 0 | Overlay and offer integration already present in dev; old cumulative stack lacks child selection and subsequent reservation hardening. Conflicts with dev despite clean status against its parent branch. Retain pending #658 acceptance. |
| [#665](https://github.com/asoftby/mamago2/pull/665) | SUPERSEDED | 2 / 64 | Yes | 0 | Current public command path already calls atomic reserveSlot (6bf46824). Old stack conflicts with newer child ACL, service and hold-expiry work. Preserve integration tests; retain draft pending #658 acceptance. |
| [#662](https://github.com/asoftby/mamago2/pull/662) | SUPERSEDED | 1 / 64 | No | 0 | Only changed file is byte-identical in dev: public slots route introduced by acc4bb1982fac7368cb37820d7a85880d333e706. Safe to close as superseded without deleting branch; does not close release issue #658. |
| [#660](https://github.com/asoftby/mamago2/pull/660) | NEEDS_WORK | 4 / 64 | Yes | 0 | Conflicts with newer quote acceptance/confirm/outbox implementation; unique older service, parent route and integration tests remain. Retain draft, map invariants and port only missing tests. Depends on business inbox and #656; no automatic integration. |
| [#647](https://github.com/asoftby/mamago2/pull/647) | KEEP_DRAFT | 4 / 91 | No | 0 | Unique invite consent UX and delegated-access architecture; grants/guest scopes unfinished. Keep draft. Security review of child/family ACL and consent required before enabling access. |
| [#645](https://github.com/asoftby/mamago2/pull/645) | NEEDS_WORK | 9 / 113 | No | 0 | Hero metadata changes remain distinct; overlaps brand PRs and current hero/location rendering. Merge tree clean; verify ratings source, review anchor and narrow mobile layout after refreshing base. |
| [#636](https://github.com/asoftby/mamago2/pull/636) | NEEDS_WORK | 9 / 165 | No | 1 | New LastSearchEntry, storage hook and tests are absent in dev; unique functionality remains. One unresolved review thread. Overlaps #513/#571 mobile search; privacy/URL validation and browser QA pending. |
| [#626](https://github.com/asoftby/mamago2/pull/626) | NEEDS_REBASE | 2 / 180 | Yes | 1 | Custom 1..1440 minute inputs already exist, but service/job/test differences remain. Conflicts with current plan service and #483 reminder model. Preserve existing cron; reconcile contract and timezone tests without changing scheduler. |
| [#623](https://github.com/asoftby/mamago2/pull/623) | NEEDS_WORK | 1 / 189 | No | 0 | Two-file account typography/hover change remains different. Overlaps #482/#569; review current UX and verify mobile before any integration. |
| [#608](https://github.com/asoftby/mamago2/pull/608) | NEEDS_REBASE | 1 / 219 | Yes | 1 | Conflicts with plan UI redesign. Persona-label helper and FAB component remain unique; #489 requires one CTA. Current plan has separate FAB tests, so do not merge historical page wholesale. |
| [#571](https://github.com/asoftby/mamago2/pull/571) | NEEDS_REBASE | 5 / 495 | Yes | 5 | 203 changed paths (GitHub files first page alone returned 100). Broad brand replacement overlaps #569, search, plan, offers and auth. Five unresolved threads; split semantic changes from mechanical token substitutions, visual QA required. |
| [#569](https://github.com/asoftby/mamago2/pull/569) | NEEDS_REBASE | 26 / 520 | Yes | 2 | 67 files; overlaps #571 on brand tokens and adds unique date-range test/typography. Two unresolved threads and conflicts. Extract date formatter slice, preserve newer page implementations. |
| [#566](https://github.com/asoftby/mamago2/pull/566) | NEEDS_REBASE | 5 / 524 | Yes | 1 | Welcome email components exist but design-system doc, preview and tests remain unique/different. Conflict in package/scripts and email code; unresolved thread. Explicit author restriction against auto-merge; email-client preview required. |
| [#565](https://github.com/asoftby/mamago2/pull/565) | NEEDS_REBASE | 3 / 259 | Yes | 4 | 17 files, migration and terms-step feature; five paths absent in dev. Conflicts with latest wizard/schema. Four unresolved threads. Migration rehearsal, operational-vs-moderated text decision, mobile QA and public terms display pending. |
| [#545](https://github.com/asoftby/mamago2/pull/545) | KEEP_DRAFT | 7 / 618 | No | 0 | Unique abuse guard runbook and quota/latency changes. Draft explicitly forbids automatic merge/deploy. No conflict is not proof of safety: scratch-DB quota races, provider spending cap and real measurements remain required. |
| [#513](https://github.com/asoftby/mamago2/pull/513) | KEEP_DRAFT | 7 / 729 | Yes | 0 | Unique modal-chrome components/docs/test; conflicts with current search and package scripts. Draft; retain SaveToPlanModal exclusions, keyboard/nested-sheet/mobile checks before integration. |
| [#483](https://github.com/asoftby/mamago2/pull/483) | NEEDS_REBASE | 32 / 1003 | Yes | 2 | 26 files, unique historical migration and reminder scenario; conflicts with current schema/plan. Current code has newer relative reminder support. Reconcile absolute-vs-relative model with #626; never apply or delete old migration automatically. |
| [#482](https://github.com/asoftby/mamago2/pull/482) | NEEDS_REBASE | 9 / 1003 | Yes | 1 | Six changed files with replaced calendar components now absent in dev. Conflicts and unresolved review thread. Preserve current v3 plan; map remaining hover/check-in UX against #502/#489 instead of reviving old calendar. |
| [#381](https://github.com/asoftby/mamago2/pull/381) | NEEDS_REBASE | 3 / 1546 | Yes | 0 | Historical enum migrations are absent by name, while modern birthday models exist. Conflicts with schema and billing; enum equivalence and fresh-DB migration order need review. Never merge/drop migration files just because feature now exists. |
| [#380](https://github.com/asoftby/mamago2/pull/380) | NEEDS_WORK | 2 / 1546 | No | 1 | Unique 411-line historical party spec absent at path; clean tree merge but unresolved review. Reconcile scope, expired target date, anchor and billing decisions with current birthday docs before adoption. Dependency predecessor to #381. |

No existing PR is declared MERGE_READY by this audit. Stacked #665/#668/#669 have only the audit check because CI targets dev/main; clean status against a parent branch is not a dev merge gate. Retargeting or enabling runtime flags is a separate reviewed action.

### Intersections and dependencies

- Classes: #662 → #665 → #668 → #669. Current dev independently contains the slots route, reserve command, overlay and Family Core child ACL. Preserve the later UTC fix in reserveSlot and #658 release gate.
- Birthday/Booking: #380 → #381 are historical spec/enum foundations; #660 overlaps newer acceptance/confirm/outbox paths, #656 and the business inbox. #684 changed anchor/auto-confirm behavior during this audit; no automatic merge of old lifecycle code.
- Plan: #483 absolute reminders, #626 custom relative lead time, #482 calendar, #608 FAB and #489 unified feed compete on the same UI/services. Compare semantic contracts before porting any slice.
- UI: #569 and #571 overlap brand files; #623 account headings and #645 place hero intersect them; #513 and #636 intersect mobile search. Resolve review threads and visual QA before merge.
- Family: #647 is not completed delegated access; retain consent, child ACL and current recommendation foundation. #616 must remain request-driven and use existing family/experience data.

## Issue triage

All 20 Issues were unassigned in the snapshot. Suggested owners below are roles, not invented GitHub assignees. Current deployment/data state is deliberately unverified; keep Issues open unless acceptance is demonstrated.

| Issue | Priority | Area | Suggested owner | Closure evidence / current gap |
|---|---|---|---|---|
| [#677](https://github.com/asoftby/mamago2/issues/677) | P1 | Security | Security maintainer | Remaining braces high advisory has no patch; document exposure/mitigation, fresh full/prod audits, frozen install and Node 22 CI. Do not dismiss alerts. |
| [#670](https://github.com/asoftby/mamago2/issues/670) | P1 | Booking | Booking maintainer | Elapsed confirmed PARTY is ARCHIVE/VIEW_ARCHIVE with unchanged DB status (1adb23e8); undated PARTY avoids 30-day housekeeping (7b364cbf). Contract + inbox tests prove accepted non-actionable alternative. Full completion lifecycle remains separate. |
| [#667](https://github.com/asoftby/mamago2/issues/667) | P1 | Auth | Release operator + Safari tester | Exact DEV runtime SHA, APP_ENV and same-profile iPhone Safari login/logout isolation; retain until browser evidence, no cookie values. |
| [#661](https://github.com/asoftby/mamago2/issues/661) | P2 | Repository | Repository maintainer | All PR classifications, current bases, unresolved reviews and preserved unique work recorded; complete decisions and revalidate live inventory before closing. |
| [#658](https://github.com/asoftby/mamago2/issues/658) | P1 | Classes | Classes maintainer + QA | Release-gating concurrency, cancellation/hold expiry, child ACL, business confirmation, family plan/reminders and DEV E2E. Existing code does not prove release readiness. |
| [#657](https://github.com/asoftby/mamago2/issues/657) | P3 | Repository | Repository maintainer | For every candidate prove ancestor of fresh dev, no open PR/worktree/automation refs. Local workstation refs are unavailable in this checkout; retain all branches. |
| [#656](https://github.com/asoftby/mamago2/issues/656) | P1 | Birthday | Birthday maintainer + QA | Current acceptance/confirm APIs exist, but prove quote version/CAS/tenant ACL/idempotency/resource exclusion, notifications and DEV smoke before closing; reconcile old #660 tests. |
| [#653](https://github.com/asoftby/mamago2/issues/653) | P2 | Repository | Repository maintainer | Audit + taxonomy + templates/navigation evidence; separate decisions for ruleset, safe branch retirement and each deferred PR. Keep open until follow-ups complete. |
| [#616](https://github.com/asoftby/mamago2/issues/616) | P2 | Family | Family maintainer + product owner | Request-only generation, deterministic fallback/cache, cost caps, no background LLM and Family ACL. Current PlanWeekSummary contract is not proof of the complete feature. |
| [#515](https://github.com/asoftby/mamago2/issues/515) | P3 | Routes | Routes maintainer | Replace all three inline edit/delete role decisions with canonical helper; parity for author/admin/moderator/foreign user and tests. |
| [#504](https://github.com/asoftby/mamago2/issues/504) | P2 | Content | Content maintainer | One shared link editor/safe href/sponsored semantics and roundtrip tests; UNKNOWN price never FREE, card/filter/story/import parity. |
| [#502](https://github.com/asoftby/mamago2/issues/502) | P2 | Plan | Plan maintainer + QA | Only latest unanswered visit prompt; dismiss persisted answer and browse separately authorized history; verify archive/experience contracts plus browser behavior. |
| [#489](https://github.com/asoftby/mamago2/issues/489) | P2 | Plan | Plan maintainer + product owner | v3 unified day feed, one CTA, persisted tags/manual notes/reminders/personas and mobile/desktop QA. Partial current implementation must not close full checklist. |
| [#281](https://github.com/asoftby/mamago2/issues/281) | P2 | Infrastructure | Infrastructure maintainer | SSH/Docker/missing/stopped/running cases distinct; no partial dump; mock shell tests and successful checksum. Current pipeline still conflates failures. |
| [#280](https://github.com/asoftby/mamago2/issues/280) | P1 | Infrastructure | Infrastructure maintainer | DEV app tag transition and migrate preserve DB container ID/Created; no-deps release contract and runbook, health and migration status. No production experiment. |
| [#270](https://github.com/asoftby/mamago2/issues/270) | P1 | SEO | SEO owner | GSC high-intent baseline, canonical/indexable listing + noindex filters, metadata tests and 7/14/28-day CTR measurements. |
| [#253](https://github.com/asoftby/mamago2/issues/253) | P0 | SEO | SEO owner + migration operator | Exact 13 approved Route→Article, excluded Mogilev stays private, single-hop redirects, indexable canonical+sitemap and GSC recovery evidence; no DB writes in this audit. |
| [#249](https://github.com/asoftby/mamago2/issues/249) | P0 | SEO | SEO owner | GSC accepts new sitemap, final canonical 200s and single-hop legacy redirects; production/GSC evidence still needed, no closure from code alone. |
| [#205](https://github.com/asoftby/mamago2/issues/205) | P1 | Infrastructure | Infrastructure maintainer | Immutable DEV image deploy with runtime expected SHA, DB preservation and rollback; docker.yml currently builds/pushes only. |
| [#187](https://github.com/asoftby/mamago2/issues/187) | P2 | Performance | Performance maintainer | Read-path inventory with TTL/invalidation/access class, before/after requests and DB reads per slice; representative query plans before indexes. |

## Governance and CI

- Additive label convention: `priority:P0..P3`, `area:<domain>`, `type:bug|feature|chore|docs`, and `triage:MERGE_READY|NEEDS_REBASE|NEEDS_WORK|SUPERSEDED|KEEP_DRAFT`. Existing labels are preserved; priority describes the Issue, and triage describes the current PR decision. No GitHub assignee is added without evidence of ownership.
- Active [Protect dev ruleset](https://github.com/asoftby/mamago2/rules/21597429): PR required, deletion and non-fast-forward blocked, review threads must resolve; merge method only. Zero required approving reviews, no required status checks, no bypass actors. Classic branch-protection endpoint returns 404 because governance uses a ruleset.
- Repository is public; default branch is main. At the audit snapshot, main `58a1e478c4a37445b94e4f3b453d222798b9a408` and dev are diverged (dev ahead 2970 / behind 10). Auto-merge and automatic branch deletion are off. Do not reconcile main by a blanket merge: review its ten unique commits through a separate release procedure.
- Recommendation for a separate reviewed settings change: require the existing `typecheck` job with strict current-base checking; agree human-review/ownership policy for security, migrations and infrastructure. Review skipped CI on stacked PR targets before retargeting. Do not invent CODEOWNERS identities or change access during hygiene.
- CI already runs Prisma validation, workflow tests, typecheck and extensive auth/SEO/booking/UI regressions on dev/main PRs. It has no global ESLint or production-build job; local check:push includes build. Additions need a separate focused CI PR and a measured baseline, rather than enabling unknown failing required checks.
- Docker build is dev-only and ignores docs/Markdown changes. It builds/pushes, but does not establish deployment parity. Cancellation under its concurrency group is intentional; never claim deployed from image build alone.
- PR and bug/feature templates already exist. This change adds freshness/source-SHA evidence to the PR template rather than introducing duplicate templates.

## Dependency security

Fresh full pnpm audit at the audited lockfile returned **0 critical / 1 high / 0 moderate / 0 low**. The high is `braces@3.0.3`, via `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Registry reports patched_versions `<0.0.0>` (no patched version advertised). Preserve #677 as P1: determine exposure of developer/CI glob input and use a compatible upstream fix when available; do not remove working tooling or blindly force a major version. These counts describe dependency audit, not a historical secret scan, Dependabot default-branch reconciliation or production assurance.

## Root cleanup and archival decisions

No files are deleted or moved by this PR. There are 48 root Markdown files; existing docs index incorrectly implied only README remained. Root navigation now distinguishes agent/product files, operational files and historical reports.

| Candidate | Purpose | References/imports/build/CI/deploy evidence | Decision |
|---|---|---|---|
| errors.txt | Historical compiler output, 40 lines | No references from full local rg scan excluding dumps themselves and lockfile; not imported; no scripts/workflows refer to it | #685 owns deletion; no duplicate change |
| errors2.txt | Same blob as errors.txt | Same full-repo scan; identical Git blob | #685 owns deletion |
| errors3.txt | Historical compiler output, 32 lines | Same scan, no tracked consumers | #685 owns deletion |
| errors4.txt | Historical compiler output, 27 lines | Same scan, no tracked consumers | #685 owns deletion |
| Root implementation/session reports | Historical context and potentially unique work | Each still needs inbound-link, generated-file and workflow analysis | Keep; archive one theme at a time with link repair and manifest |
| Prisma migrations / runtime scripts / configuration | Runtime, schema history and deployment contracts | Absence of current imports is insufficient proof | Keep all; separate migration/infra review |

Before any future move/delete record: purpose; rg/import and dynamic path lookup; package/build/CI/Docker/deploy consumers; archive target; repaired links; exact source blob/SHA; targeted checks. Preserve historical reports as evidence, not current instructions. No bulk filename/age cleanup; no branch retirement without workstation worktree and external automation evidence.

## Verification and execution record

- GitHub hygiene: added the taxonomy without deleting existing labels; assigned priorities/areas to all 20 initial Issues and a triage class to all 22 still-open PRs after the external #684 merge.
- Closed #662 as superseded with exact-file/commit evidence in its preserved PR body; its branch remains. Closed #670 with implementation SHAs and passing business-inbox regressions in its preserved Issue body. #658 and all other unfinished feature/release Issues remain open.
- Session-start and task-sync PASS; separate own node_modules; Prisma client generated locally, no database commands.
- Booking bucket contract PASS; business-inbox UI regression result recorded in the PR verification. Node 22 used for verification.
- `pnpm lint` completed with 31 errors and 491 warnings in existing source/scripts. This PR changes only Markdown and the audit JSON; all linted source, ESLint config, package manifest and lockfile match reconciled dev. Do not silently fix unrelated source or require a currently failing global lint job. Initial default-heap typecheck exhausted 4 GB; rerun uses an explicit 8 GB heap on Node 22.
- Verification below records actual outcomes; no green status is inferred from an incomplete check.
- Node 22 typecheck with an 8 GB heap passed. `task-finish.sh` refreshed dev, verified task-only diff and ran the real pre-push hook. The gate passed typecheck and earlier regression groups, then failed in `test:birthday-catalog`: `honestBuilder.contract.test.tsx:116` calls `listUserBirthdayParties`, which queries Prisma without a configured DATABASE_URL. No database was accessed. The hook rejected push; no new PR was created, no checks were bypassed and the production build was not reached. A separately authorized isolated test database is needed to complete the gate.
- GitHub CI on audited dev `1dbb4f654b8f5302cdcf3ccaa9e45b3a4882fda2` passed: [run 39676757021](https://github.com/asoftby/mamago2/actions/runs/39676757021). This does not verify these unpublished documentation commits.
- Execution actions (closed items, labels, PR URL and commit SHA) are recorded in the final handoff. No production, DB, cron, secret, main or ruleset changes are authorized by this document.

## Next decisions

1. P0 SEO #249/#253: obtain runtime/GSC evidence through the release owner; do not replace missing evidence with code inspection.
2. P1 #658/#656/#667: isolated DB concurrency/ACL tests and DEV/browser sign-off; #280/#205 need controlled DEV infrastructure proof; #677 needs upstream advisory/exposure review.
3. Reconcile #685 with fresh dev and complete its mandatory gate; then review the five-path diff. Do not duplicate its README/deletions.
4. Resolve older PR intersections and outstanding reviews in small topical PRs; preserve exact heads in the JSON snapshot. Keep #653/#661 and unfinished feature Issues open.
