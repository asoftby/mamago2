# mamaGo 2.0 — PROD → DEV source reconciliation

**Evidence date:** 2026-10-23. **Live control:** [Release Control #714](https://github.com/asoftby/mamago2/issues/714). **Baseline PR:** [#715](https://github.com/asoftby/mamago2/pull/715).

> Scope: read-only GitHub commit/file comparison and SQL inspection. The two runtime identities below come from the operator's `curl /api/health` transcript. This is **not** authorization to deploy or migrate any database. All commits and PRs are evaluated against the pinned snapshots below; refresh before execution.

## 1. Actual running source identities

| Location | Build ID | Git SHA | Process started UTC | Health |
|---|---|---|---|---|
| PROD mamago.by | `dev-801` | `e3681f5390ce22b5b8538045686077a3a72f0a59` | 2026-10-20T13:37:47.838Z | status=ok, db=ok |
| DEV dev.mamago.by | `dev-839` | `3ecbde45f3d23dc847da30d5668ad52a58c9c701` | 2026-10-22T05:46:51.764Z | status=ok, db=ok |
| GitHub `dev` snapshot | — | `1f3ff2b1b53e1cccfbf50003cff10a430259d467` | — | remote HEAD |

- PROD runtime SHA is the merge of **PR #629** (My Plan week summary).
- DEV runtime SHA is the merge of **PR #690** (SEO journal categories).
- The current GitHub dev snapshot is the merge of **PR #712** (cross-city continuation).
- These three SHAs form a **linear ancestor chain**, as shown by GitHub compare; no source-history divergence between these snapshots.

## 2. Diff summary

| Source interval | Ahead | Behind | GitHub compare files returned |
|---|---:|---:|---:|
| PROD → running DEV | 191 | 0 | 200 (may be truncated; do not claim exhaustive file count) |
| running DEV → GitHub dev | 47 | 0 | 62 |
| PROD → GitHub dev | **238** | 0 | **255** |

Total file categories in the 255-file compare: UI/components 82; backend services 60; libraries 34; docs 24; API endpoints 15; public/admin pages 13; GitHub CI 6; operations scripts 6; Prisma models 2; Prisma migrations 3; dependencies/build 3; other 7. These are changed paths, not individual tasks or final QA evidence.

## 3. PR placement by deployed source boundary

Search basis: the 56 PRs reported merged since 20 Oct 2026. This is a *recent merge cohort*, not an exhaustive enumeration of all 238 Git commits. The branch deployment status below is determined from merge commits and the pinned linear boundary.

### Already present in running PROD (0)

- None among this 56-PR recent merge cohort. PR #632 and #633 belong in the DEV-only cohort, not PROD.

### In running DEV, not in PROD (40)

| Area | Merged PRs |
|---|---|
| Birthday/booking/B2B | [#684](https://github.com/asoftby/mamago2/pull/684), #678, #674, #673, #672, #666, #663, #655 |
| Classes | #671, #659 |
| Authentication / dependency security | #681, #679, #664 |
| My Plan / ideas / save UI | #652, #648, #642, #641, #640, #638, #637, #628, #618, #610, #650, **#633** |
| Public place, ranking, search, relations | #646, #644, #634, #609, **#632** |
| Wizard / responsive / account | #683, #643, #630, #584, #651, #649 |
| SEO / repository governance | #690, #686, #685, #654 |

**Interpretation:** code is deployed to DEV by SHA, but E2E release acceptance is **not** proved by this merge placement.

### Merged to GitHub dev, NOT YET on the running DEV (12)

| PR | Change | QA/release implication |
|---|---|---|
| [#712](https://github.com/asoftby/mamago2/pull/712) | Cross-city continuation and event detail | Verify visibility, canonical/SEO and other-city listing |
| [#709](https://github.com/asoftby/mamago2/pull/709) | DEV GSC secret staging | Must verify owner-provided DEV config; never print secrets |
| [#708](https://github.com/asoftby/mamago2/pull/708) | Direct GSC Search Console API | Requires fresh schema, worker collection and admin read-path smoke |
| [#707](https://github.com/asoftby/mamago2/pull/707) | Published offer visibility | Verify approved / hidden / disapproved place behavior |
| [#703](https://github.com/asoftby/mamago2/pull/703) | Wrong keyboard layout search | Regression testing |
| [#701](https://github.com/asoftby/mamago2/pull/701) | Compact price inputs | Mobile/desktop visual QA |
| [#700](https://github.com/asoftby/mamago2/pull/700) | Business Telegram docs | Documentation |
| [#699](https://github.com/asoftby/mamago2/pull/699) | Offer public detail slug resolution | Regression for offer URL and 404 semantics |
| [#696](https://github.com/asoftby/mamago2/pull/696) | Signed Telegram party callback foundation | Confirm signing/idempotency, no execution without proper bot |
| [#694](https://github.com/asoftby/mamago2/pull/694) | Shared-host Docker prune protection | Code merge does NOT imply host patch applied; verify safe deploy |
| [#692](https://github.com/asoftby/mamago2/pull/692) | Business Telegram connection/delivery | Schema and isolated DEV/PROD bot config |
| [#688](https://github.com/asoftby/mamago2/pull/688) | Birthday approved offers and BYN sign | Birthday listing and mobile price QA |

**The 47 commits include these 12 merged PRs plus internal/related commits; PR count and commit count must not be added.** This stage requires deploying and proving the exact GitHub DEV SHA on DEV before any PROD promotion.

### Merged to main, not a DEV/PROD release signal (4)

[#713](https://github.com/asoftby/mamago2/pull/713) GSC workflow registration, #682, #680, #676 dependency security. `main` is not the source for PROD image deployment; related security patches #679/#681 landed in dev. Compare actual content/alerts separately rather than claiming main commits deployed.

## 4. Prisma migrations across actual source interval

| Migration | In code running DEV? | In GitHub dev? | Static SQL observations |
|---|---|---|---|
| `20261021120000_party_anchor_confirmation` | Yes | Yes | Adds PartyOrderEntry/PricingMode enums, new BookingActivityType value, PartyOrder and PartyOrderItem columns, nullable FK to User. Defaults for new NOT NULL columns; no DROP. |
| `20261022020000_business_telegram_bot` | No | Yes | Creates BusinessTelegramConnection and BusinessTelegramLinkToken with unique/lookup indexes; depends on pre-existing TelegramEnvironment enum (present in PROD schema); no DROP. |
| `20261022120000_gsc_query_cache` | No | Yes | Creates GscQueryCache with JSONB rows and expiresAt index; no DROP. Model is in `prisma/gsc.prisma`; prisma.config.ts schema='prisma' loads multi-file schema. |

**Static result:** all three appear additive on the inspected SQL. **Not yet verified:** actual `_prisma_migrations` history on PROD/DEV, drift, locks/table volume, dry-run on correctly cloned scratch DB, backup success, or schema compatibility with old app on rollback. Do not mark migrations safe for PROD based solely on SQL review.

## 5. High-risk release gates

- [ ] Read-only query of `_prisma_migrations` on DEV and PROD, including failed/pending migrations (see #280/#281). `status=ok` only proves DB connectivity.
- [ ] Docker inspect actual app **and worker** containers on both environments; compare image digests/revision labels, not only public `gitSha`.
- [ ] Verify shared host free space and owner-approved rollback/backup procedure. Do not run Docker prune on the shared host.
- [ ] Confirm database-safe forward migration path, current backup with checksum and restore test in isolated environment; record lock-impact review for PartyOrder tables.
- [ ] Reconcile #665/#668/#669 stacked class PRs: runtime features may be present while PRs remain open; full #658 E2E is mandatory.
- [ ] Birthday quote/anchor/resource/idempotency E2E, #656; Business Telegram pairing and signed callback with proper DEV bot, #704.
- [ ] GSC service account restricted access, private-key handling, worker and admin parity; #689. No external Google calls when disabled.
- [ ] Public /minsk/offers/klub-esteticheskoy-gimnastiki-silfida and /minsk/events/noch-v-konyushne, cross-city detail, legacy URLs, sitemap, robots and canonical checks; #695 still open.
- [ ] Verify fresh `dev` CI on exact planned SHA, then deploy DEV by owner-approved mechanism, verify runtime SHA and execute smoke/E2E.
- [ ] Only then prepare PROD release candidate with exact digest/target commit and migration/rollback approval. No PROD deployment now.

## 6. What has NOT been done

No deployment, tag promotion, Docker/SSH host mutation, Prisma migration, database read, backup or restore was performed in this task. GitHub Actions checks and image digests were not established by the available connector. A current static comparison does not prove runtime regressions are absent.

## 7. Canonical operational log

Updates and acceptance evidence should be added to [Issue #714](https://github.com/asoftby/mamago2/issues/714). Older [PR triage](../engineering/repository-audit-2026-10-22.md) contains individual open PR conflicts and dependencies. [Baseline release register PR #715](https://github.com/asoftby/mamago2/pull/715) tracks the foundational status model.