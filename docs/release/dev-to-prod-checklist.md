# mamaGo 2.0 — DEV → PROD Readiness Checklist

**This file is the single source of truth for taking the current mamaGo 2.0
DEV environment to the first PROD deployment.** Claude Code, Codex, Cursor,
and any other coding agent working in this repository on DEV → PROD readiness
must read this file first and follow it.

This document is separate from `docs/migration/prelaunch-checklist.md`
(Project Phoenix — the WordPress-to-mamaGo content migration effort). That
file covers a prior, largely-complete migration/RC track. This file covers a
distinct, current concern: **is the mamaGo 2.0 DEV codebase, as it exists
right now, safe and ready for its first PROD deployment.** Do not merge the
two documents or their processes.

---

## RELEASE STATUS (update this block as work proceeds)

```
DEV:   MEDIA DATASET VERIFIED (actual dev.mamago.by)
PROD:  NOT READY

Active task:        Task 7 (Day Scenario) — STATUS:
                     COMPLETE_PENDING_BROWSER_SMOKE (still not flipped to
                     COMPLETE). SSH access to DEV was restored in a
                     follow-up round: created isolated QA fixtures (one
                     disposable real account + 4 DB-inserted PlanItems) and
                     ran all 12 requested interactive checks against the
                     still-running `dev-274`/`c10398f2` (no redeploy). 11 of
                     12 GREEN: 3-item CTA, populated Scenario creation,
                     fixed-time display, "Гибкое время" labeling,
                     conflict detection, "План изменился", "Обновить
                     сценарий" preserving overrides, no duplicate
                     DayScenario, mobile 375px. 1 RED, a real bug: assigning
                     a flexible item's time via "Назначить время" displayed
                     back 3 hours off (the DEV container runs UTC with no
                     TZ set; the write path parsed the "HH:MM" input using
                     that ambient server timezone while every display uses
                     the browser's). Root-caused and fixed
                     (`localWallClockToUtc()` in
                     `src/lib/date/localDateKey.ts`, explicit
                     Europe/Minsk conversion, no ambient-timezone
                     dependency — caught and corrected a same-class bug in
                     the fix's own first draft via testing under forced
                     TZ=UTC/America/New_York). Fix is committed + tested
                     locally but NOT deployed this session (out of scope
                     per instruction) — cannot be re-verified live until
                     the next deploy. All QA fixtures (both rounds)
                     confirmed fully removed from real DEV. Task 6 COMPLETE.
Checklist corrected: 2026-08-12 by Codex — restored owner-approved Tasks 12
                     and 13; renumbered the former Tasks 12–15 to 14–17.
Last updated:       2026-08-11
Last updated by:    Claude Code — Task 7 (Day Scenario) UX/functional
                     completion phase, on top of the already-accepted
                     backend foundation (schema, persistence, fingerprint,
                     conflict detection, ownership isolation, no Google
                     Routes — all preserved unchanged). This phase: (1)
                     traced "Без времени" to a real data-projection gap —
                     `PlanItem.startsAt` genuinely null for some add-flows
                     even when the Activity has one unambiguous
                     `ActivitySession` — and fixed it by recovering that
                     time only when truly unambiguous (0 or 2+ same-date
                     sessions still correctly fall through, never guessed);
                     (2) added Scenario-specific flexible-time assignment
                     (new `DayScenarioItemOverride` model, hand-written
                     migration, structural ownership checks, no client-
                     trusted ids) that participates in sorting and conflict
                     detection and survives "План изменился" reconciliation
                     (kept for retained items, FK-cascade-dropped for
                     removed ones); (3) found and fixed a real product
                     inconsistency — the My Plan overlay panel always said
                     "Собрать сценарий дня" even when a Scenario already
                     existed, unlike the full page — by threading Scenario
                     status through the *existing* per-date
                     `/api/save/plan/day` fetch (no new round trip, no
                     polling); (4) redesigned the timeline (time as primary
                     visual anchor, "Гибкое время" instead of "Без
                     времени", removed price from Scenario cards entirely —
                     the new Scenario-only query doesn't even select price
                     fields anymore, closing that bug class by construction
                     rather than hiding it in the UI). Free-gap/end-of-day
                     summary are fully implemented but honestly never
                     fabricate — no reliable duration field exists anywhere
                     in the schema today, confirmed by full-schema grep.
                     `tsc`/`eslint`/`pnpm test:day-scenario`/`pnpm
                     check:push` all green; extensive browser verification
                     including override persistence-across-reload and the
                     full plan-changed→refresh→override-preservation round
                     trip. Not yet deployed to actual DEV — that step is
                     owner-controlled. Full detail in Task 7's own section
                     below.
Prior — Claude Code — Task 6 (Article Actions) is CLOSED.
                     Implementation (`d923e1f6`) shipped Save (Ideas/Plan,
                     via the existing SaveActivityFlowAdaptive chooser) and
                     Share (via the existing ShareModal) across all 5
                     required surfaces (homepage journal row, /blog +
                     /{city}/blog cards, standard Article detail, Breaking
                     News detail, continuous reading), per the owner's
                     canonical UX contract: cards = Heart only, detail/
                     landing = Heart+text + Share+text. New `ArticleIdea`
                     model + `PlanItem.articleId` (hand-written migration,
                     applied to DEV). Bounded batch save-status endpoint
                     built specifically to avoid Article-card N+1. Guest
                     pending-action resume extended with "article". Test
                     suite `test:article-actions` green; full local build/
                     lint/typecheck gate green. Deployed-DEV smoke
                     confirmed green by the owner — Task 6 closed
                     COMPLETE (full detail in Task 6's own DEV SMOKE field
                     below). After closure, the owner requested a narrow,
                     UI-only visual refinement to the homepage Article
                     card (5-card desktop rail sized like the Events row,
                     Heart inset into the cover, real category metadata
                     when present, tail artifacts removed) — 3 corrective
                     commits (`e4a1b6bb`, `d8be9416`, `9decd216`), pushed to
                     `dev`, do not reopen Task 6 (see Task 6 BACKLOG/NOTES).
                     Owner deployed `dev-272` (built from `9decd216`,
                     confirmed via SSH + image label). Targeted post-deploy
                     visual verification on actual `https://dev.mamago.by`:
                     green — Heart/category/no-tails/no-Share/interaction/
                     mobile all confirmed on live DEV, no P0/P1 introduced
                     (full detail in Task 6's BACKLOG/NOTES). Nothing left
                     pending for Task 6.
Prior task:         Task 5 — Content Analytics & Ranking (COMPLETE). Audit
                     found a real,
                     already-shared UserEvent-derived ranking engine
                     (kudaDiscoveryFeed / classesDiscoveryFeed /
                     planSuggestions, plus the real Boost model for paid
                     Offer visibility) already meeting the task's exit
                     criteria, alongside a confirmed PLAN_ADD/SAVE
                     weight-ordering bug and a dead, conflicting second
                     weight table. Owner narrowed scope to a formalize-and-
                     correct-only change: fixed the weight ordering
                     (PLAN_ADD now outranks SAVE), consolidated to one
                     canonical weight table (`engagementWeights.ts`),
                     retired the dead `discoverySignalWeights.ts` — no
                     personalization, no new ranking layer, no ratings
                     wiring, no Stories-rail changes. Implemented + 4
                     targeted DB tests + committed (`d5b149bc`), audit/
                     backlog docs committed (`33fdb234`), pushed, CI +
                     Docker Build & Push green (`dev-270`), owner deployed.
                     Deployed-DEV regression smoke green: Kuda feed ranks
                     normally, Classes/Offers loads (genuinely 0 PUBLISHED
                     Offers today, unrelated to this change), My Plan
                     suggestions return real data via the corrected scoring
                     function, Search unchanged, zero ranking-related
                     errors (one unrelated, pre-existing, non-ranking
                     console error investigated and ruled out as a
                     regression — see Task 5 DEV SMOKE for detail).
                     Ratings/reviews explicitly deferred to an optional
                     future quality/trust layer per owner decision, updated
                     in place as BACKLOG-041 (not duplicated). Prior
                     session (Task 4 closure): fixed silent address data
                     loss in the Event Wizard (`de4d694a`) and a
                     pre-existing Docker build-arg gap affecting all Google
                     Maps features (`5bd4371b`, `dev-269`) — full detail in
                     Task 4's own section below.
Unresolved P0/P1:   none from Task 1–6 (all CLOSED, COMPLETE). Task 7 remains
                     COMPLETE_PENDING_BROWSER_SMOKE. Tasks 8–17 remain TODO,
                     not started
```

Do not hand-wave this block. It must reflect the actual current state of
Tasks 1–17 below, not aspiration or memory of a prior session.

---

## 0. Purpose

Not to reach a perfect codebase. To safely, quickly, and predictably bring
the current mamaGo 2.0 DEV state to a condition suitable for the **first**
PROD deployment. See §3 (Release Goal) and §4 (Release Readiness Is Not Code
Perfection) below — these govern every decision made against this checklist.

## 1. Source of Truth Priority

When sources disagree, resolve in this order:

1. Actual current repository state (code, schema, migrations, config —
   read it, don't assume it).
2. This file, `docs/release/dev-to-prod-checklist.md`.
3. Other current project documentation (e.g. `CLAUDE.md`,
   `docs/engineering/backlog.md`).
4. The persistent engineering backlog (`docs/engineering/backlog.md`) for
   anything not covered above.
5. Old session/chat/prompt context — lowest priority, never authoritative.

A past description of an implementation is never proof of current state.
Before changing any functionality, verify the current implementation by
reading it.

## 2. Release Goal

**SIMPLE → REUSE → MAINTAINABLE → CHEAP → SECURE.**

Development toward first PROD should be optimally fast, simple, understandable,
maintainable, safe, predictable, cheap in server/runtime cost, and cheap in
external API usage — without unnecessary architectural complexity, without
duplicating existing functionality, without endless refactoring, and without
endless repeated verification. Do not overengineer for hypothetical future
scenarios. Do not create a new model, service, abstraction, component,
analytics pipeline, ranking engine, storage layer, or background job if the
existing architecture can be safely extended instead.

## 3. Release Readiness Is Not Code Perfection

Release is not blocked on eliminating all technical debt. Once the mandatory
release scope (Tasks 1–17) is satisfied, only problems that genuinely affect
PROD safety or readiness get fixed. The following do **not** block PROD on
their own: refactoring opportunities, architecture cleanup, cosmetic cleanup,
legacy cleanup, code style, optional test improvements, future optimizations,
nice-to-have UX, theoretical edge cases without real production impact, or
technical debt that creates no release risk. All of these go to
`docs/engineering/backlog.md`.

## 4. Severity Model

- **P0 — CRITICAL.** PROD is forbidden. Real security vulnerability, data
  loss/corruption, broken authentication, broken authorization/data
  isolation, a critical production flow not working, destructive migration
  risk, unsafe deployment, missing critical infrastructure. Must fix before
  PROD.
- **P1 — HIGH.** Substantial, confirmed production risk. Must fix before
  PROD.
- **P2 — MEDIUM.** Does not block a safe first PROD. Goes to
  `docs/engineering/backlog.md`; release process continues.
- **P3 — LOW.** Cleanup / optimization / future improvement. Goes to backlog
  if it has real value. Does not block PROD.

An agent may never promote a P2/P3 to P0/P1 just because it wants to rewrite
or improve an implementation. See §14 (New Finding Decision Flow) for how to
classify a new finding.

## 5. Checklist Freeze

After creation, the main release scope (Tasks 1–17, their Exit Criteria, and
the rules in this document) is **FROZEN**. A newly found task does not
automatically become a new mandatory checklist item. First ask: *is it truly
unsafe or wrong to go to first PROD without this?* If no → backlog. See §17
(Checklist Immutability Rule).

## 6. Backlog Routing Rule

Every real engineering follow-up that does not block first PROD must be
recorded in `docs/engineering/backlog.md` — never left only in chat, terminal
output, an agent's final report, or a session's memory. If an agent says
"can wait", "post-release", "doesn't block PROD", "technical debt",
"cleanup later", "future improvement", or "nice to have" about something that
is a real engineering task, it must go into the persistent backlog.

P2/P3 findings never become a new release task, never extend an existing
Exit Criteria, never start a new implementation project, never block marking
a task `COMPLETE`, and never reopen a completed task. The backlog is expected
to be non-empty before PROD — that is a normal release state.

## 7. P0/P1 Scope Extension Rule

Only a confirmed P0/P1 may extend release scope, and only when the agent
records: (1) what was found, (2) which real PROD flow is affected, (3)
severity, (4) why it is unsafe to defer, (5) the minimal necessary fix. An
imperfect architecture, agent preference, a chance to write less code, a
missing optional test, a theoretical risk without realistic impact, a chance
to make something prettier, or the mere existence of legacy code are never
by themselves grounds for P0/P1.

A new finding may be added as a sub-item of an existing Task 1–17 only if the
task's existing Exit Criteria cannot be met without it, or it is a confirmed
P0/P1. Otherwise → backlog. Exit Criteria are never expanded after the fact
for nice-to-haves.

## 8. Completed Tasks Stay Closed

A task marked `COMPLETE` is not reopened for P2/P3 findings — those go to
backlog. Reopening a `COMPLETE` task is allowed only when a confirmed P0/P1
means its Exit Criteria is no longer actually met. The reason for reopening
must be recorded in that task's entry.

## 9. AUDIT FIRST (mandatory for every task)

Most functionality likely already exists, fully or partially. A checklist
item does not mean "implement from scratch." Before touching application
code, run a **read-only audit** and classify:

- **EXISTING** — already implemented and usable.
- **PARTIAL / BROKEN** — exists but is incomplete, broken, disabled,
  unintegrated, or not production-ready.
- **MISSING** — genuinely does not exist.
- **DO NOT TOUCH** — already works, no change needed.
- **IMPLEMENTATION SCOPE** — the minimal confirmed scope of change.

Where relevant, check: components, APIs, routes, services, hooks, utilities,
Prisma models, admin UI, public UI, business UI, analytics, ranking,
migrations, tests, feature flags, related content types, legacy
implementations.

Working principle: **UNDERSTAND → FIND GAPS → MINIMAL SCOPE → IMPLEMENT.**
Never rewrite working functionality without proven necessity.

## 10. Status Model

```
TODO
  ↓
AUDIT_IN_PROGRESS
  ↓
AUDIT_COMPLETE
  ↓
IN_PROGRESS
  ↓
COMPLETE_PENDING_BROWSER_SMOKE
  ↓
COMPLETE
```

Also available: `BLOCKED`. If an audit confirms functionality is already
fully implemented and working: `AUDIT_COMPLETE → VERIFY → COMPLETE`. A task
existing in this list never implies mandatory code changes.

## 11. One Main Task At A Time

For core DEV → PROD work: one main functional task per pass. Do not run
multiple overlapping tasks/worktrees at once unless scopes are genuinely
independent, Git isolation is safe, changes don't overlap, and coordination
overhead doesn't exceed the benefit. Do not create a worktree unless
necessary.

## 12. Commit Discipline

Create an atomic commit after each logically completed and verified
phase/section: `AUDIT → confirmed scope → implementation → targeted
verification → atomic commit → next phase`. Commit when a phase is logically
complete, understood, verified, leaves the repo in a working state, contains
no foreign changes, and can be safely reverted. Do not commit after every
line, after every tiny edit, after unverified state, or purely to inflate
commit count. Prefer several small meaningful commits over one huge diff.

## 13. Risk-Based Verification

Do not turn development into endless identical checks.

- **Small change** — targeted test, scoped lint/typecheck, `git diff
  --check`, specific browser verification if relevant.
- **Completed phase** — verify the affected flow: targeted tests,
  integration tests, browser smoke, DB/query verification, security
  verification, performance sanity check — only where relevant.
- **Completed task** — run a sufficient task-level gate. Use `pnpm
  check:push` when it's actually needed to confirm task completion. Do not
  rerun a full heavy build after every small edit.
- **Before PROD readiness** — a full final gate (Task 17) is mandatory.

## 14. New Finding Decision Flow

```
FINDING
  ↓
Does this block a safe first PROD?

YES — proven P0/P1  → minimal fix within current release scope
NO  — P2/P3          → docs/engineering/backlog.md, continue original task
UNCERTAIN            → short targeted investigation to determine severity
                        (do not start implementation before severity is known;
                        if significant PROD risk isn't confirmed → backlog)
```

## 15. Scope Creep Protection

Do not let: Search audit → backend rewrite; Analytics → data platform;
Ranking → ML platform; Schema audit → full SEO redesign; Security audit →
full auth rewrite; Performance audit → global optimization campaign; gallery
work → editor rewrite; Day Scenario → routing platform. Fix the confirmed
task in the minimal reliable way.

## 16. Simplicity / Server Cost / Security Evaluation

For every task, weigh:

- **Simplicity** — can it be solved with less code/fewer entities?
- **Reuse** — does an existing implementation already cover this?
- **Server cost** — does the change introduce N+1 queries, unnecessary DB
  reads/writes, polling, heavy per-request computation, excessive analytics,
  unnecessary or duplicate storage, expensive external API calls, Google API
  overuse, unnecessary background jobs, unbounded datasets, or excess network
  traffic?
- **Security** — does it weaken authentication, authorization, RBAC,
  validation, rate limiting, object ownership, data isolation, privacy,
  input handling, secrets handling, or upload security?

Given comparable outcomes, choose the simpler, cheaper, and more secure
option.

## 17. Checklist Immutability Rule

After initial creation, this checklist's structure is considered approved.
Without a separate explicit decision from the project owner, do not: add new
main Tasks, remove existing Tasks, expand Exit Criteria with nice-to-have
requirements, change the release philosophy, change the P0/P1/P2/P3 rules,
change backlog routing, or turn this into a new planning document. Only
operational updates are allowed: STATUS, AUDIT, GAPS, IMPLEMENTATION,
COMMITS, VERIFICATION, DEV SMOKE, BLOCKERS, confirmed P0/P1, and links to
backlog entries. This checklist is the operating system of the current
release, not something to keep redesigning.

## 18. Per-Task Progress Fields

Every Task 1–17 below uses this compact template. Do not turn it into an
agent diary.

```
STATUS:        <one of the Status Model values>
AUDIT:         EXISTING / PARTIAL / MISSING — short findings
GAPS:          what actually remains
IMPLEMENTATION: minimal accepted scope
COMMITS:       SHA(s) of completed phases
VERIFICATION:  checks actually performed
DEV SMOKE:     result of user-facing verification
BLOCKERS:      only real blockers
BACKLOG/NOTES: links to non-blocking follow-up
```

---

# PART I — PRODUCT READINESS

## TASK 1 — Import Images Into DEV

Priority: `P0 — PROD BLOCKER`

STATUS: `COMPLETE`
AUDIT:
EXISTING — `MediaAsset`/`MediaUsage` model, storage abstraction
(`src/server/media/media-storage.ts`, env-overridable `MEDIA_STORAGE_ROOT`),
public serving routes (`/api/media/[filename]`, `/api/media/file/[...path]`),
upload pipeline. Real WP-image import pipeline proven end-to-end:
`PlaceMediaSyncer` (download → checksum/lineage dedup → `MediaAsset` +
`PlaceImage`, idempotent, never deletes rows, URL+lineage-keyed reuse) and
`EventMediaSyncer`, both driven by `scripts/migration-commit-wordpress-db.ts`
(`--entity place|event --media-policy FULL --limit N --context-config
<path> --confirm-writes`, WP SSH read-only via `--allow-remote-readonly`).
`--media-policy FULL` explicitly overrides the LOCAL/DEV sampled-policy gate
(`shouldSampleMedia()`/`resolveSampledMediaPolicy`) with **no code change
needed** — confirmed by direct code read of
`scripts/migration-commit-wordpress-db.ts:339-343,605-668`. DEV Postgres
(`mamago2-db`, port 5433) + `storage/uploads` (542 files, 43MB) already hold
real migrated + admin-uploaded media (181 `MediaAsset` rows, all ACTIVE, 0
orphans). Place/Route/RouteStop/Event/Offer card+detail components already
render missing images gracefully (placeholder or omitted block, confirmed
via `MediaCover`, `RouteDetailClient`, `OfferCard`, `mapOfferPageMedia.ts`
`og-default.jpg` fallback) — no broken `<img>` anywhere today.
PARTIAL — Place: only 5/83 have gallery images (3 sample WP keys + place 437
partial + one more); 78 clean Places are METADATA-only (no images) purely
because of the LOCAL/DEV 9-key sample allowlist, not a pipeline defect.
Event (Activity, all 10 are type EVENT): 5/10 have `coverImageId`, 1/10 has
gallery, same sample-allowlist cause. Article: 9/26 have `coverImageId`,
9/26 have ≥1 inline image block, 1/26 has a gallery block — remaining gap is
documented as source-side (`PASS_WITH_DOCUMENTED_SOURCE_MEDIA_GAPS`), not a
pipeline defect.
MISSING — Offer: 0/63 (all PUBLISHED) have `coverImage`/`galleryImages`; no
`OfferImage` table, no delegate; `--entity offer --media-policy FULL` is
hard-blocked in code (`migration-commit-wordpress-db.ts:261`). This is a
**deliberate founder decision** (`prelaunch-checklist.md` line 1040:
"Founder decision (applied 2026-07-29): Offer media Option B, explicit P1
defer"), applied only after fixing a real defect (broken 49-byte
`og-default.jpg` placeholder → real 1200×630 JPEG) so Offers already render
cleanly with a graceful fallback everywhere. Not reopened here — see
`docs/engineering/backlog.md` BACKLOG-015.
DO NOT TOUCH — Route/RouteStop media (small entity count, already renders
gracefully with no images; import for these is a separate historical
`ROUTE_STOP_MEDIA_POLICY_METADATA_SKIPPED` decision, not required for Task 1
exit criteria). `MediaAsset`/storage/serving layer itself — works, not
touched.
GAPS: Event, Article, and Place gaps closed this session (see VERIFICATION).
Event/Article used the existing importer's narrow, hash-gated replay paths
unmodified. Place required one narrow, scoped addition (see IMPLEMENTATION)
after the original `--force-reprocess` path was found systemically blocked
(BACKLOG-016, now resolved). Route/RouteStop gap (13/14 Routes, 80/90
RouteStops without media) remains open: no safe replay path exists yet
(BACKLOG-017) — reviewed for severity and confirmed **not** P0/P1 (small,
secondary entity, already renders cleanly with no broken images, not one of
the core main sections) — does not block this task's Exit Criteria. Offer
gap (0/63) remains open by a pre-existing, unrelated founder P1-defer
decision (BACKLOG-015) — Offers render cleanly via an approved fallback.
IMPLEMENTATION: Owner approved the write phase (2026-08-07), then explicitly
directed resolving the Place blocker as in-scope Task 1 work rather than a
deferred backlog item. No changes to `classifyPlaceUpdateSafety()` (the
generic Place UPDATE conflict guard stays fully intact, protecting the real
content-commit path). Added one narrow, explicit CLI path,
`--force-place-media-replay` (`src/lib/migration/runtime/
placeMediaOnlyReplay.ts`, wired into `scripts/migration-commit-wordpress-db.ts`,
commit `32be8beb`), that calls `PlaceMediaSyncer.sync()` directly —
bypassing the conflict gate only for this path, which is safe by
construction because `PlaceMediaSyncer` structurally never writes to the
`Place` row (only `PlaceImage`/`MediaAsset`/`MigrationLineage(MEDIA_ASSET)`),
confirmed by reading the class and empirically (byte-identical `Place` row
diff, including `updatedAt`, before/after). Identity/mapping is verified via
active `PLACE` `MigrationLineage` + a live WP fetch before any write, same
posture as the existing Event/Article replay guards. Targeted tests added
(`placeMediaOnlyReplay.test.ts`, 16 cases, all pass); `tsc --noEmit` and
`eslint` clean on all changed/new files.
For Events/Articles: `pnpm migration:commit:wordpress-db --entity event
--force-media-reprocess --media-policy FULL --source-record-key <key> ...`
and `--entity article --force-article-media-replay --media-policy FULL
--media-owner-user-id <id> --source-record-key <key> ...`, both pre-existing
hash-equality-gated single-record replay paths, unmodified.
COMMITS: `bf5a1557` (audit docs), `f1d1505d` (write-phase results + two
blockers), `32be8beb` (Place media-only replay code + tests). Write-phase
DB/storage changes are DEV data operations, not source-controlled — see
VERIFICATION below for proof.
VERIFICATION:
Event — all 10 source-eligible Activities attempted (5 already had a cover
from a prior session): 4 newly `APPLIED` (real download → `MediaAsset` +
`Activity.coverImageId`/`ActivityImage` → verified public URL 200 → verified
present in server-rendered HTML), 1 `FAILED` (source WP post no longer
published — real source-side gap, not a pipeline defect). Net: 9/10 Events
now have a cover (was 5/10). Idempotency proven: re-running an already-
synced key returns `NOOP_ALREADY_SYNCED`, 0 new writes.
Article — 17 candidate Articles (of 26 total, all missing a cover)
attempted: 4 `APPLIED` (3 got a new cover + inline images, 1 got inline
images only because its own WP source has no featured image — real source
variance, not a defect), 7 `FAILED` (source WP attachment rows genuinely
gone, `ARTICLE_MEDIA_ATTACHMENT_MISSING`, article left fully untouched per
fail-closed design), 6 `REFUSED` (`ARTICLE_MEDIA_REPLAY_CONTENT_DIVERGENCE`
— live WP content no longer matches DB `contentJson`, i.e. the article was
edited after import; replay correctly refused rather than risk overwriting
an editorial change). Net: 12/26 Articles now have a cover (was 9/26); one
verified sample rendered 30 real inline+cover image URLs server-side, all
200. Idempotency proven the same way (`NOOP_ALREADY_SYNCED` on rerun).
Place — initial attempt with the generic `--force-reprocess --media-policy
FULL` path on 3 representative clean source keys
(`wordpress-db:places:5457/5492/5515`) failed identically with
`PLACE_UPDATE_CONFLICT: TARGET_MODIFIED_AFTER_IMPORT` — root-caused to the
2026-07-29 mass Place publication session's value-neutral `updatedAt` bump
(BACKLOG-016). Audited 3 representative blocked Places field-by-field
against a fresh WP-source preview: confirmed the source-content hash itself
is unchanged (preview action: `SKIP_UNCHANGED`) but DB state has genuinely
drifted from the original import in places (one had a manually-edited
`customAddress`/`formattedAddr` = "Test address"; two had slug spelling
drift from a transliteration-library change) — proving the conflict guard
is correctly protecting real, if minor, divergence, not just noise. Built
`--force-place-media-replay` (see IMPLEMENTATION), which sidesteps this
safely because it never touches any content field regardless of whether
content drifted. Golden proof: 3 records (5457/5492/5515) — full chain
verified (WP source → download → `storage/uploads` → `MediaAsset` →
`PlaceImage` → public `/api/media/file/...` URL → 200 → rendered in
server HTML at the canonical `/places/{slug}` URL, confirmed via Browser
pane screenshot, desktop + mobile 375×812, 0 console errors); `Place` row
byte-identical before/after including `updatedAt` (`diff` exit 0); 0
duplicate `PlaceImage` rows; rerun of all 3 returned `NOOP_ALREADY_SYNCED`
with 0 new writes. Full batch: remaining 65 clean Place source keys with
real source media — 58 `APPLIED`, 7 `NOOP_ALREADY_SYNCED`, 0 `PARTIAL`, 0
`REFUSED`, 0 hard failures. Net: Place gallery coverage 5/83 → **68/83**.
The 15 remaining have no source media at all or are the 1 non-WP-origin
Place (verified by cross-checking against the source preview's
`mediaRefCount`) — not closable by this or any importer.
Route/RouteStop — not attempted (unchanged from audit). `RouteCommitRunner`
has no Place-style conflict guard and no narrow media-only replay path
exists — running the generic `--entity route --media-policy FULL` path
carries an unverified risk of silently overwriting Route content (see
BACKLOG-017). Reviewed for severity per Task 1 Exit Criteria: **not**
P0/P1 — see BACKLOG-017 for the recorded reasoning. All 14 Routes/90
RouteStops confirmed rendering cleanly with no broken images (code-read
verified, `RouteCard`/`RouteDetailClient` fallbacks) — accepted as-is for
this release.
Offer — untouched, as decided (pre-existing, BACKLOG-015).
Storage/DB deltas (full session, before → after):
`MediaAsset` 181 → 1073, `storage/uploads` 542 files (43MB) → 3327 files
(316MB), `ActivityImage` 4 → 11, `PlaceImage` 51 → 478 (+427, all via the
new replay path). No duplicate `MediaAsset` rows possible (`storageKey` has
a DB `@unique` constraint); no duplicate `PlaceImage` rows found (checked
directly); no orphan files/rows found in the pre-write-phase DB-vs-disk
filename diff.
DEV SMOKE: Targeted, via the Browser pane against the running DEV server
(not the full Task 17 site-wide smoke). Place detail
(`/places/kofta-na-pr-t-mira-1`, then `/places/malberri-klab-mulberry-club`):
gallery of real photos renders correctly on desktop and mobile (375×812),
breadcrumb/address/CTA all correct, 0 relevant console errors. Article
detail (cover + inline gallery, 30 image URLs verified present and 200) and
Event detail (`immersivnaya-vystavka-neboreka-planeta-posle-shuma`, new
cover renders) both confirmed via screenshot — clean, no broken images. One
transient burst of `ERR_CONNECTION_REFUSED` was observed on a page load
that coincided with the heavy background batch script + a webpack
recompile; confirmed non-reproducing (immediate reload succeeded, and a
`read_network_requests` check showed the same resources retried
successfully to 200) — not a real defect, not the DEV app's normal
behavior.
BLOCKERS: none — prior ACTUAL-DEV target discrepancy resolved this session
(see VERIFICATION addendum below). Task 2 was not started.
ACTUAL DEV VERIFICATION (2026-08-07, Cursor — closes Task 1):
Physical host `ubuntu` at `134.17.17.134` (DNS for `dev.mamago.by`; SSH alias
on this Mac is still named `mamago-prod` — name is misleading, not used as
environment proof). Traefik routes `Host(dev.mamago.by|admin.dev.mamago.by|
business.dev.mamago.by)` → compose project `dev` / container `dev-app-1`
(`ghcr.io/asoftby/mamago2:dev-259`). Same host also runs isolated PROD stack
`prod-app-1` / `prod-db-1` for `prod.mamago.by` — never written.
DEV DB: Postgres `dev-db-1`, database/user `devmamago`, volume
`dev_db_dev_data`. DEV storage: Docker volume `dev_mamago2_storage` →
`/app/storage` in `dev-app-1` (distinct from `prod_mamago2_storage`).
PROD isolation proof (read-only after import): PROD `PlaceImage=0`,
`MediaAsset=0`, article/event covers=0, PROD storage ~12KB / 0 upload
files. Deployed DEV image lacks the newer local replay CLI sources; import
ran from this Mac against DEV via SSH tunnel to `dev-db-1:5432` + staged
`MEDIA_STORAGE_ROOT` synced into `dev_mamago2_storage` only (no app deploy,
no PROD touch). WP source `134.17.16.78` reachable from Mac (not from DEV
host TCP/22).
Before (actual DEV): Place 80 / PlaceImage 0 / MediaAsset 2 / Article 26
(0 covers) / Event 8 (1 cover) / storage ~6 files ~192KB.
Place proof (5 unique-lineage keys 5492/5515/63360/10343/10370): APPLIED;
Place business fields byte-stable including `updatedAt`; public media 200;
canonical `/places/{slug}` HTML contains gallery URLs; rerun
`NOOP_ALREADY_SYNCED`. Skipped duplicate active lineage
`wordpress-db:places:5457` (two Place rows) — non-deterministic
`findFirst` target.
Place full unique-lineage remaining 73: APPLIED 57, NOOP 6,
SOURCE_MEDIA_MISSING 10 (genuine; not forced). Net Place gallery coverage
**64/80** with images; PlaceImage **445**; skipped-without-media / no
unique lineage remain as documented gaps.
Event: 3-proof then full 8 — APPLIED/NOOP covers → **6/8** with cover;
2 WP posts no longer published; 1 existing cover refused
`EVENT_MEDIA_ONLY_TARGET_MEDIA_DIVERGENCE` (safety correct). Idempotent
rerun `NOOP_ALREADY_SYNCED`. Note: several Events have `cityId=null`, so
`/{city}/events/{slug}` shows "Событие не найдено" even though cover
`MediaAsset` public URL returns 200 — pre-existing routing/data gap, not
an importer defect (P2 residual).
Article: actual DEV corpus differs from prior local DB. Proof 3 APPLIED
(title/slug/status/author unchanged); idempotent `NOOP_ALREADY_SYNCED`.
Remaining without cover 23: APPLIED 9, CONTENT_DIVERGENCE 5 (refuse —
preserve edits), IMPORT_INCOMPLETE/missing attachments 9 (article left
untouched). Net **10/26** Articles with `coverImageId`. All DEV Articles
remain `PENDING`, so anonymous `/api/media/file/...` correctly returns
`access denied` for article-only media; Place/Event published linkage
serves 200. Admin media library query (`getAdminMediaList`) has **no**
filter excluding `sourceType=MIGRATED`; DEV now has **1055 MIGRATED + 2
ADMIN_UPLOAD** ACTIVE `MediaAsset` rows — visibility gap was empty-target
data, not a query bug. Admin UI itself not browser-logged-in (auth wall).
After: MediaAsset **1057**, PlaceImage **445**, storage uploads **3326**
files / **~321MB** on `dev_mamago2_storage`.
DEV SMOKE (actual `https://dev.mamago.by`, Browser): Place detail+gallery
desktop and mobile 375×812 for Mulberry Club and «Кофта» на Мстиславца, 2 —
images render, naturalWidth>0, HTTP 200, usable layout. Event city page
not found (cityId null). Article public pages not applicable while
PENDING. Media library: data/query-level OK; UI needs admin session.
BACKLOG/NOTES: BACKLOG-015 unchanged. BACKLOG-016 DONE and re-proven on
actual DEV via `--force-place-media-replay`. BACKLOG-017 unchanged P2.
BACKLOG-018 root cause resolved this session (safe actual-DEV access path
documented + used) — status updated in `docs/engineering/backlog.md`.
Non-blocking residuals (P2): Event `cityId=null` public routing; duplicate
Place lineage `places:5457`; SSH alias `mamago-prod` naming for the DEV IP;
Articles remaining PENDING / source-attachment gaps; orphan migrated
MediaAssets without entity link (BACKLOG-021).

METADATA FOLLOW-UP (2026-08-08, Cursor — audit then metadata-only backfill;
does **not** reopen Task 1 Exit Criteria / binary import):
AUDIT verdict — **not UI-only**. Admin «Файл» shows
`effectiveMetadata.title || displayFilename`; many stored `title` values
were raw WP `post_title` (camera/hash/numeric). Importer never set
`alt`/`caption`; `MediaUsage` was not created for migrated links, so
admin auto-gen could not help. `originalName`/`filename`/lineage correctly
preserved. Public Place gallery already uses place `title` as `<img alt>`
(`mapPlacePageMedia`) — independent of MediaAsset.alt.
EXISTING: meaningful WP titles kept (e.g. Mulberry «…02»); lineage +
originalFilename preserved; Place public alts already semantic.
BROKEN/MISSING (pre-backfill): alt/caption null on migrated assets;
technical titles where WP post_title was technical; 0 MediaUsage on
migrated links.
SAFE BACKFILL: `pnpm media:backfill-migrated-metadata` — metadata +
MediaUsage only; no binary/storage/entity content writes; preserves
non-empty alt/caption and meaningful titles; orphans without discoverable
entity link left unchanged (BACKLOG-021). Eligible linked set after
extend discovery (Place gallery, Event cover/gallery, Article
cover/seo/content): **699/1055** with alt + usage; full rerun
`SKIP_UNCHANGED` / usageAlready. Samples: Place Mulberry title kept +
alt filled; Event Nebo.Reka title decoded + alt; Article Pets Fest cover
+ inline semantic titles; `originalName` unchanged; Mulberry file
`content-length` still 65336 (= `sizeBytes`).

AUDIT FIRST the existing media migration/import architecture and the real
DEV state. Check: MediaAsset, storage, media linkage, existing import
scripts, Places, Articles, Offers, Services, Programs, Routes, RouteStop,
profile/business media (if in migration scope), public media access, broken
URLs, fallback, cards, detail pages, galleries, mobile, desktop. Must check:
idempotency, duplicate media, repeated downloads/imports, duplicate storage,
network cost, server cost. Do not create a new importer if the existing one
can be safely used/finished.

**Exit Criteria:** DEV contains a sufficient production-like media dataset
for a full visual smoke of the main sections.

## TASK 2 — Search Ranking

Priority: `P0`

STATUS: `COMPLETE`
AUDIT:
EXISTING — Real, live public search: `SearchDocument` (Prisma model,
`entityType|entityId|title|searchText|summaryLine|metaLine|imageUrl|urlPath|
isPublished|boost|updatedAt`, unique on `[entityType,entityId]`, indexed on
`isPublished`) is the actual search index, kept current by
`SearchIndexerService`/`prismaSearchExtension.ts` (Prisma Client Extension
firing on every `activity/offer/place/route/article` write) and per-entity
builders under `src/lib/search/builders/`. Public endpoint
`src/app/api/search/route.ts` (`GET /api/search?q=&limit=&cityId=`) queries
`SearchDocument` with a case-insensitive substring match, orders by
`boost desc, updatedAt desc`, live-enriches `activity` results from current
DB state, and fire-and-forget logs every query to `SearchQueryLog` via
`src/lib/search/logSearchQuery.ts`. UI: `SearchOverlay`/`SearchInput`/
`SearchResults`/`SearchResultItem` (desktop) + `MobileSearchSheet`/
`MobileSearch*` (mobile), 250 ms debounce, both wired to the same endpoint.
Ranking is a real, understandable, deterministic formula: hardcoded
per-entity-type multiplier in `src/lib/search/constants.ts`
(`SEARCH_BOOST = {activity:1.25, offer:1.15, place:1.1, route:1.0,
article:0.85}`) applied as `SearchDocument.boost`, tie-broken by recency
(`updatedAt desc`). No hidden/dynamic scoring — fully predictable.
Zero-result demand is already fully detectable: `SearchQueryLog`
(`query|resultsCount|clickedEntityId?|cityId?|userId?|sessionId?|createdAt`,
indexed on `query`, `resultsCount`, `[query,resultsCount]`, `createdAt`) is
written on every real search; `GET /api/admin/search/zero-results`
(admin-only, `src/app/api/admin/search/zero-results/route.ts`) does a
bounded (`parsePaginationParams`, capped `limit`), parameterized
(`$queryRaw` tagged template — no injection risk) `GROUP BY query WHERE
resultsCount=0` aggregation with a working `/admin/search/zero-results` UI.
Admin cannot arbitrarily break organic ranking: confirmed as already true,
found and fixed by a **prior 2026-08 audit session** (self-documented in
code comments, not this session's work) — `RankingSettings`/`BoostSettings`
(`/admin/ranking/weights`, `/admin/ranking/boost`) and the separately
modeled `SearchRankingSettings` (`/admin/search/ranking`) are two
independent duplicate ranking-weight systems, **neither read by any
production ranking code** (confirmed again this session by re-reading
`src/lib/search/constants.ts` and both admin handler files end-to-end); both
are locked to HTTP 403 on every mutation with an explicit Russian-language
"does not affect production ranking" banner in the admin UI. `StoryIntentConfig`
(today/tomorrow/weekend/breaking_news/free story-rail intents, unrelated to
the search text box) is real, live, and correctly admin-editable with
optimistic-concurrency (`updatedAt` check) + audit logging
(`logAdminAudit`). RBAC verified correct: `isRankingAdmin` requires
ADMIN/MODERATOR, `isSearchRankingAdmin` and the zero-results route require
ADMIN, all checked before any DB read/write.
PARTIAL/BROKEN — Confirmed via a representative golden-set evaluation
against real DEV data (`https://dev.mamago.by`, read-only, Browser pane):
(1) **Word-order-sensitive matching (the real, significant gap — fixed this
session, see IMPLEMENTATION)**: the single `contains` substring match meant
a query only matched if its exact character sequence appeared in the
indexed blob — e.g. `q=балет три поросенка` matched, but the equally
natural `q=три поросенка балет` and `q=детский сад` (target contains
"детский" and "сад" separately, not adjacent) returned **zero** results
even though every individual word was present. This affects ordinary
Russian-language queries, not just edge cases. (2) Transliteration/wrong
keyboard layout/typo tolerance genuinely do not exist (`q=teatr`,
`q=ntfnh`, `q=театор`, `q=мулберри` all → 0 results against a corpus that
has an obvious real match for each) — real but lower-severity, deferred,
see GAPS/BACKLOG. (3) `SearchQuickTag`/`SearchSynonym` admin CRUD exist but
have zero runtime consumers; `/admin/search` overview page shows hardcoded
mock stats; `SearchIndexRecord`/`indexManager.ts`/`/admin/search/index`
dashboard reads a table nothing populates (the real index is
`SearchDocument`, unaffected) — all inert admin-surface debt, not
production-search-breaking.
MISSING — No seasonal-boost subsystem (confirmed not needed: existing
`StoryIntentConfig` + `SEARCH_BOOST` already cover the real product need at
this scale, per the task's own "do not build a separate seasonal subsystem
if existing intents/settings suffice" guidance). No `PopularQuery`/
`FrequentQuery`/`ZeroResult` dedicated models — not needed, `SearchQueryLog`
already derives both ad hoc and cheaply.
DO NOT TOUCH — `SearchIndexerService`/`prismaSearchExtension.ts`/builders
(real, live, correct); `SearchQueryLog` + zero-results admin flow (real,
live, correctly bounded/parameterized); `StoryIntentConfig` +
`/admin/ranking/stories-intents` (real, live, correctly audited);
`SEARCH_BOOST` ranking formula (simple, predictable, adequate at current
catalog size — no proven need for a more complex/dynamic model); the
already-locked `RankingSettings`/`BoostSettings`/`SearchRankingSettings`
read-only guard (correctly prevents admin from silently believing they
affect ranking — do not re-enable without first wiring them to real
scoring, per the existing code comments).
IMPLEMENTATION SCOPE: fix the confirmed, reproducible word-order matching
gap with the minimal safe change — split the query into whitespace tokens
and require each token to match independently (AND) instead of one
whole-string substring match; single-token queries are byte-for-byte
unchanged (no regression). Add a bounded query length (200 chars) and token
count (10) cap as cheap, low-risk input hardening (previously unbounded).
No schema change, no new engine, no new dependency, reuses the exact same
`SearchDocument`/Prisma query shape.

GAPS: Transliteration/keyboard-layout/typo tolerance (BACKLOG-022), mock
admin search-overview stats (BACKLOG-023), dead
`SearchIndexRecord`/`SearchQuickTag`/`SearchSynonym`/debug-route
scaffolding (BACKLOG-024), uncalled `logSearchClick()` (BACKLOG-025) — all
confirmed real via this audit, none block Task 2 Exit Criteria, all routed
to backlog per §14/§24 (none is a proven P0/P1: search already works
reliably for the word-order-corrected common case, ranking is already
predictable, admin already cannot break organic ranking).
IMPLEMENTATION: `src/app/api/search/route.ts` — added `buildSearchTextWhere()`
(AND-of-tokens for multi-word queries, unchanged single-`contains` for
single-token queries) and `MAX_QUERY_LENGTH`/`MAX_QUERY_TOKENS` caps. No
other files changed; no migration; no admin/API surface added.
COMMITS: `<see git log — code fix + test>`, `<see git log — checklist/backlog
closure>` (recorded below after commit).
VERIFICATION: New targeted test
`src/app/api/search/route.test.ts` (self-contained fixture, created/torn
down within the test, real local dev DB) — 5 cases: out-of-order multi-word
query matches, single-token query unaffected (no regression), a token
genuinely absent from the document correctly excludes it (AND, not OR),
oversized query (5000 chars) handled gracefully, 50-token query handled
gracefully. All pass (`npx tsx src/app/api/search/route.test.ts` →
`/api/search word-order tests: OK`). `npx tsc --noEmit` clean. `npx eslint
src/app/api/search/route.ts src/app/api/search/route.test.ts` clean.
Performance/security sanity: `SearchDocument` corpus is small (~276
published entities across all 5 types per Task 1 counts) so the added
`AND` of `contains` clauses is still a single cheap sequential scan, no
index needed at this scale (noted as a P3 forward-looking item only, not
current risk); zero-results/admin routes already bounded and parameterized;
RBAC on all admin search/ranking routes verified correct; no new dependency
or external API call introduced.
DEV SMOKE: **Complete — verified live on actual `https://dev.mamago.by`
after owner Telegram deployment (2026-08-08).** Deployed-version evidence:
no public SHA/build header is exposed (`/api/health` → `{"status":"ok",
"db":"ok"}`, no version field; `/admin/system/build` correctly redirects to
login, not bypassed per instruction) — proof is therefore **behavioral**:
the word-order fix (which provably did not exist in the pre-deploy image —
reproduced broken in this same task's earlier phase) is now live, which is
only possible if `7dc3a285`'s image is what's actually serving traffic.
Golden-set queries via direct `/api/search` fetch against real DEV:
`балет три поросенка` → 200, ["С. Кибирова балет «Три поросенка»"] ✓;
`три поросенка балет` (reordered — the critical regression case) → 200,
same single correct result ✓ (previously 0 results, confirmed broken
earlier this session); `детский сад` (multi-word) → 200, 4 relevant results
(previously 0) ✓; `три поросенка` (exact/short) → 200, correct result,
unregressed ✓; `малберри` → 200, correct results, unregressed ✓;
`asdkjfhaskdjfh9182z` (zero-result) → 200, `[]`, no 500 ✓. Desktop UI: typed
`три поросенка балет` into the real `SearchOverlay` at 1280×720 — correct
result card rendered, clicking it navigated to
`/minsk/events/s-kibirova-balet-tri-porosenka` and the Event detail page
loaded correctly (title, date, price, cover image). Zero-result UI: typed
`asdkjfhaskdjfh9182z` — clean "Ничего не найдено / Попробуйте изменить
запрос" empty state, no crash. Mobile UI (375×812, `MobileSearchSheet`):
opened the sheet (`MobileSearchEntry` → `Поиск` full-screen panel) and
typed `три поросенка балет` (via a direct DOM `input`/`change` event
dispatch — the Browser pane's coordinate-based `computer` click tool hit a
transient timeout specifically on this full-screen sheet transition,
reproduced on both the original and a fresh tab; confirmed to be a
tool-delivery quirk, not an app defect, since the same button's native
`.click()` DOM call — a faithful simulation of a real click — opened the
sheet correctly and the console showed no error either time) — same
correct single-result card rendered, no layout break. `read_console_messages`
on both desktop and mobile passes showed **no new errors**, only the same
pre-existing, unrelated guest-session 401s from `/api/save/status` (present
before this session's changes, confirmed via `read_network_requests` —
nothing to do with search). No `/api/search` request returned non-200 on
either viewport. Cheap regression sanity: Place
`/minsk/places/malberri-klab-mulberry-club` (imported gallery, Task 1 work)
renders its full gallery (9 images, 6 shown + "+6") with all
`/api/media/file/...` requests returning 200 — no regression from the
pushed stack. `/admin/media` correctly redirects to login when
unauthenticated (not bypassed, per instruction) — Admin pagination check
not performed (no authenticated session naturally available), not treated
as a blocker per instruction not to spend time bypassing auth.
BLOCKERS: none — resolved. Prior blocker (fix unverified on actual DEV)
closed by this session's post-deploy read-only smoke.

**Git Release Safety — Pending DEV Update (2026-08-08, read-only check,
no push/deploy performed):** branch `dev`, local HEAD `7f7cc66d`.
`git fetch origin dev` → `origin/dev` = `2ecebe1b`, which is the exact
merge-base with local `dev` — i.e. a **clean fast-forward**, local `dev` is
12 commits ahead of `origin/dev` with zero divergence/conflict risk. Those
12 local-only commits (oldest→newest: `5c76bc85` checklist creation through
`7f7cc66d` this Task 2 closure) are all legitimate prior-session Task 1 +
admin-pagination + Task 2 work — nothing unexpected. `git status --short`:
only `next-env.d.ts` (known foreign, untouched) and this checklist file
(this status-correction edit) are modified; no untracked files. Confirmed
`next-env.d.ts` is not present in either `68917508` or `7f7cc66d` (`git show
--stat` on each). Task 2's own diff (`cfa5a536..7f7cc66d`) touches exactly
4 files: `docs/engineering/backlog.md`, `docs/release/dev-to-prod-checklist.md`,
`src/app/api/search/route.ts`, `src/app/api/search/route.test.ts` — no
unexpected files. **Not pushed, not deployed** — per instruction, deployment
is owner-controlled via Telegram; this agent does not push or deploy.
BACKLOG/NOTES: BACKLOG-022 (transliteration/layout/typo — real but
deferred, no proven necessity yet for new fuzzy-matching infrastructure),
BACKLOG-024 (remaining dead search-adjacent scaffolding: `SearchIndexRecord`/
`indexManager.ts`, `SearchQuickTag`/`SearchSynonym` still have no runtime
consumer — now honestly disclosed in-UI instead of removed, see ADMIN
SEARCH CORRECTIVE PHASE below), BACKLOG-025 (uncalled `logSearchClick`).
BACKLOG-023 (mock admin stats) is **no longer deferred** — owner pulled it
back into Task 2 scope, see below. Search click-through/CTR-as-a-ranking-
signal work intentionally left for Task 5 (Content Analytics & Ranking) per
this checklist's own task boundaries — not started here.

ADMIN SEARCH CORRECTIVE PHASE (2026-08-08, Claude Code — owner reopened
scope immediately before the deployed-DEV browser smoke; the runtime search
fix itself, verified live on `dev.mamago.by` at `7dc3a285`, is NOT reverted
or redone here):
AUDIT — Full read of all six `/admin/search/*` tabs (Overview, Quick Tags,
Synonyms, Zero Results, Index, Ranking) plus `SearchLayout.tsx`,
`QuickTagModal.tsx`, `SynonymModal.tsx`, `src/types/search-ranking.ts`.
Findings:
(1) Overview (`src/app/admin/search/page.tsx`) — **fully mock**: hardcoded
`stats` array (`"Searches Today": "12,847"` etc.), hardcoded fake
`popularQueries` array with fabricated CTR percentages, and an explicit
English "This is a mock dashboard... Backend integration... will be added
in the next phase" banner. Confirmed zero connection to real
`SearchQueryLog` data. English UI throughout.
(2) Quick Tags / Synonyms — real CRUD against real `SearchQuickTag`/
`SearchSynonym` tables (not mock data), but English UI throughout, and each
had a **false behavioral claim**: Quick Tags labeled its preview "Preview
(as shown to users)" when in fact `resolveVisiblePopularTags()` always
returns `[]` in production (confirmed in Task 2's original audit,
`popularSearchTags.ts`) — tags are never shown publicly today. Synonyms had
an "How Synonyms Work" card asserting "the search engine will also include
results for all its synonyms" — false; `/api/search/route.ts` does not
consult `SearchSynonym` at all (confirmed again by re-reading the route).
(3) Zero Results — real data (`SearchQueryLog` via
`/api/admin/search/zero-results`, unchanged), English UI only.
(4) Index — built entirely around `SearchIndexRecord`, which nothing in the
live write path populates (confirmed again). With 0 rows, its "Index
Health" calculation (`total>0 ? indexed/total : 100`) rendered a misleading
**100%** "healthy" figure for an empty, disconnected table. English UI.
(5) Ranking — already correctly locked read-only with an honest Russian
disclosure banner from a prior 2026-08 audit session (unchanged, confirmed
still accurate); only the surrounding labels (header, "Weight", boost
level words, `RANKING_BOOSTS` label/description strings) were still
English.
GAPS CONFIRMED IN SCOPE: mock/fabricated Overview data (BACKLOG-023, now
in-scope), false "already works" claims on Quick Tags/Synonyms, misleading
100%-health Index display, English UI across all six tabs and both modals.
IMPLEMENTATION (minimum safe correction — no new engine, no schema changes
beyond one new read-only aggregation, no deletion of existing dead
tables/CRUD):
- New `computeSearchOverview()` (`src/server/services/search/
  adminSearchOverviewHandlers.ts`) — real `SearchQueryLog` aggregates for a
  7-day window: total queries, unique queries, zero-result queries, and a
  top-10 "popular queries" list (`groupBy` + `orderBy: {_count}` — no raw
  SQL needed). Deliberately reports **no CTR** field anywhere (click-
  through isn't tracked — BACKLOG-025) rather than inventing one. New route
  `GET /api/admin/search/overview` (`src/app/api/admin/search/overview/
  route.ts`, ADMIN-only, same auth pattern as the sibling zero-results/
  synonyms routes).
- `src/app/admin/search/page.tsx` rewritten: removed all mock arrays and
  the "mock dashboard" banner; renders the real 7-day stats, a real
  popular-queries table (query/count/last-searched only — no fabricated
  CTR/status columns), an honest "CTR — не отслеживается" tile instead of
  a fake percentage, and a Russian info card stating what actually drives
  ranking (the fixed `SEARCH_BOOST` constants).
- Quick Tags / Synonyms pages: added an honest amber disclosure banner each
  (matching the Ranking tab's existing pattern) stating the current
  non-connected status; corrected "Preview (as shown to users)" →
  "Предпросмотр (когда подключение появится)"; rewrote the false "How
  Synonyms Work" claim into an accurate "Сейчас не влияет на живой поиск"
  notice; full Russian localization of both pages and both modals
  (`QuickTagModal.tsx`, `SynonymModal.tsx`).
- Index page: added an honest amber disclosure explaining
  `SearchIndexRecord` is not populated by the real indexing pipeline (the
  real index is `SearchDocument`, managed automatically) and that 0
  records / "—" health means "no data," not "everything indexed"; health
  score now renders "—" instead of a misleading 100% when `total === 0`;
  full Russian localization. Table/actions kept (not deleted) — inert but
  harmless, matches the "do not delete legacy infrastructure without
  necessity" principle; Task 2's own §7 guidance and the existing
  `RankingSettings`/`BoostSettings` precedent (disclose + lock, don't
  delete) was followed rather than removing the tab.
- Ranking page + `src/types/search-ranking.ts`: translated remaining
  English labels (header, "Weight", boost-level words, all six
  `RANKING_BOOSTS` label/description strings) to Russian; the existing
  read-only lock and its disclosure banner were untouched.
- `SearchLayout.tsx` tab labels translated to Russian (Обзор / Быстрые
  теги / Синонимы / Без результата / Индекс / Ранжирование).
- Fixed three residual English fallback error strings that could reach the
  admin ("Failed to save tag/synonym", "Action failed").
DO NOT TOUCH: the runtime search fix (`src/app/api/search/route.ts`,
`68917508`) — not modified, not reverted, its own test still passes
unchanged (confirmed by rerun). `RankingSettings`/`BoostSettings`/
`SearchRankingSettings` read-only lock — unchanged, still correctly
prevents admin from affecting production ranking. `SearchQueryLog`/
zero-results aggregation — unchanged, only reused (proven pattern) for the
new overview endpoint.
COMMITS: `<see git log — Admin Search corrective changes>` (recorded below
after commit).
VERIFICATION: New targeted test `src/server/services/search/
adminSearchOverviewHandlers.test.ts` (self-contained fixture, real local
dev DB) — 2 cases: real counts reflect actual `SearchQueryLog` rows (not
fabricated), and no `ctr` field is ever present in the response (proving
the "don't invent CTR" instruction is honored in code, not just prose).
Both pass. `npx tsc --noEmit` clean across the whole repo. `npx eslint` on
all changed/new admin-search files: 0 errors (6 pre-existing warnings,
none introduced by this phase — unused-var/hook-dependency warnings
predating this change, confirmed by diff). Grep sweep for remaining
English UI copy across all six tabs + both modals: clean (only intentional
`<code>` references to literal Prisma model names remain). Full `pnpm
check:push` (`pnpm build`) — exit 0, "Compiled successfully in 2.8min".
Re-ran `src/app/api/search/route.test.ts` (the word-order fix's own test)
to confirm the runtime fix is untouched — still passes.
DEV SMOKE (pre-deploy): Unauthenticated `GET /api/admin/search/overview` on
the local dev server returned `401 {"success":false,"error":"Unauthorized"}`
(not a 500), confirming the new route is wired correctly; `/admin/search`
correctly redirected to `/auth` (login) for an unauthenticated session.

DEV SMOKE (post-deploy, actual `admin.dev.mamago.by`, 2026-08-08 — closes
Task 2): Admin Search corrective phase (`23e1b006`, `84114c10`) pushed
(`7dc3a285..84114c10`), CI `success`, Docker Build & Push `success`, owner
deployed via Telegram. Owner manually authenticated in the Browser pane at
`admin.dev.mamago.by` (this session never saw/entered/stored any
credential); once confirmed, ran a read-only smoke of all six tabs against
that live authenticated session:
- **Обзор** — no mock banner; real 7-day stats (46 queries / 34 unique / 21
  zero-result, cross-checked against the Zero Results tab's own 21); real
  popular-queries table showing this session's own actual test queries
  ("три поросенка балет", "малберри", "детский сад", "ntfnh", "teatr" —
  literal proof of real `SearchQueryLog` data, not fabrication); CTR tile
  honestly reads "Не отслеживается" with an explanation, no fake percentage.
- **Быстрые теги** — Russian; real CRUD (0 tags, real empty state "Быстрых
  тегов пока нет"); honest amber disclosure that tags aren't yet shown
  publicly, replacing the old false "Preview (as shown to users)" claim.
- **Синонимы** — Russian; real CRUD (0 synonyms, real empty state); honest
  amber "Сейчас не влияет на живой поиск" disclosure naming `/api/search`
  directly, replacing the old false "How Synonyms Work" claim.
- **Без результата** — Russian; real `SearchQueryLog` data (21 total / 17
  unique, matching Overview), table rows are this session's actual test
  queries including the transliteration/layout probes ("ntfnh", "teatr");
  honest closing note that synonyms/quick tags aren't wired to live search.
- **Индекс** — Russian; explicit disclosure that `SearchIndexRecord` isn't
  the real index (`SearchDocument` is, updated automatically); health
  correctly renders `—` (not a false 100%) with 0/0/0/0/0 stats and an
  honest "Нет данных в этой таблице" state — no misleading "healthy"
  claim on empty/dead data.
- **Ранжирование** — Russian; existing read-only disclosure intact
  ("Только для чтения... нигде не читаются production-кодом"); all six
  boost cards render as static, non-interactive bars — no edit control
  exists in the UI at all (matches the API's existing 403-on-mutation
  lock, unchanged) — admin cannot mutate `RankingSettings`/`BoostSettings`.
- **Cross-cutting**: tab navigation works across all six tabs; tables,
  stat cards, and empty states all render correctly; verified again at a
  375px mobile viewport (Overview, Quick Tags) — cards stack, tabs scroll
  horizontally, no broken layout; `read_network_requests` confirmed every
  `/api/admin/search/*` call returned 200 (`overview`, `index?page=1`,
  `ranking`) — zero 500s; the only console error seen (`401`) was not from
  any `/api/admin/search/*` endpoint on any of the six pages (unrelated,
  pre-existing, not investigated further as out of Task 2 scope).
No settings/data were modified during this smoke (read-only, per
instruction) — did not click "Создать первый тег"/"Создать первый
синоним" or attempt any mutation against the locked Ranking API.
BLOCKERS: none. All six deployed Admin Search tabs passed.

AUDIT FIRST existing Search / Ranking infrastructure: Search API, search
ranking, search analytics, normalization, intents, transliteration, wrong
keyboard layout, typo handling, frequent queries, seasonal queries,
zero-result queries, admin controls, RankingSettings, BoostSettings,
StoryIntentConfig or related models, existing tests. Do not create a new
ranking engine without proven necessity. Ranking runtime must stay cheap and
predictable.

**Exit Criteria:** Search works reliably on real DEV data; ranking signals
are understandable; an admin cannot arbitrarily break organic ranking.

## TASK 3 — Publication Analytics

Priority: `P0`

STATUS: `COMPLETE`
AUDIT:
EXISTING — A real, substantial, DB-backed first-party analytics system
already exists, not just search-adjacent scaffolding. `UserEvent` (Prisma
model: `userId?|sessionId?|eventType: UserEventType|entityType?|entityId?|
vertical?|cityId?|meta: Json?|createdAt`, indexed on
`[userId,createdAt]|[sessionId,createdAt]|[eventType,createdAt]|
[entityType,entityId,createdAt]|[vertical,createdAt]|[cityId,createdAt]`) is
the single event log, written via `trackUserEvent()`
(`src/server/services/analytics/AnalyticsEventService.ts`, fire-and-forget,
never throws) from a validated public endpoint (`POST /api/analytics/events`,
zod-validated enum fields, meta capped 4096 bytes, no IP/UA stored — only
optional `userId`/client-generated `sessionId`). `UserEventType` covers
`PAGE_VIEW|CARD_VIEW|DETAIL_OPEN|SAVE|UNSAVE|PLAN_ADD|PLAN_REMOVE|CTA_CLICK|
SEARCH_APPLY|FILTER_APPLY|BOOKING_*|FEEDBACK_LEFT`; `AnalyticsEntityType`
covers all 5 target content types (`EVENT|PLACE|OFFER|ROUTE|ARTICLE`).
**The critical Open/View signal already fires for real**: `AnalyticsDetailBeacon`
(server component, writes `DETAIL_OPEN`) is wired into every one of the 5
content types' real detail pages (confirmed by reading each: events, places,
offers incl. programs, routes, articles incl. city-scoped blog) — the
historical risk named in this task's own instructions ("View/Open event
реально не эмитится") is **not** the case here; it was already fixed before
this session. `CARD_VIEW` (listing impression, `AnalyticsCardViewTracker`,
IntersectionObserver ≥35% visibility, fires once via a `useRef` guard — no
double-count risk, including under React StrictMode double-invoke) is wired
for Event and Route listing cards. `SAVE`/`PLAN_ADD` are tracked for
Place/Event (`/api/save/idea`, `/api/save/plan`); `CTA_CLICK` is tracked for
Event's plan/buy actions (`EventPageView.handlePlan/handleBuy`). Admin
`/admin/analytics` is a real, 5-tab (Overview/Audience Segments/Behavior/
Content Performance/Funnels), RBAC-gated (`requireRole([ADMIN,MODERATOR])`)
dashboard suite — every tab fetches its own bounded/parameterized
`/api/admin/analytics/*` endpoint backed by real `UserEvent`
aggregation (`analyticsOverview/ContentPerformance/Funnels/Behavior/
Segments.service.ts`); grep for mock/fake/placeholder markers across all 10
admin-analytics components found nothing — **no mock data**, unlike the
Search overview's pre-fix state in Task 2. Business-facing per-publication
performance is real too, just not under a page named "Analytics":
`/business/dashboard` (`getBusinessWorkspaceData`/`getPerformanceMetricsByEntity`,
`src/server/services/business/businessWorkspace.service.ts`) shows a real
"top publications" table (views/saves/planAdds/ctaClicks per Event/Offer)
and `getBookingAnalytics(businessId)` shows real rolling-30-day booking
stats — both **server-side scoped** (`OR:[{businessId},{ownerUserId}]` /
`ownerBusinessId` directly in the Prisma `WHERE`, confirmed by reading the
query code, not just the UI) — no cross-business data-isolation risk found.
PARTIAL/BROKEN — Confirmed via direct code reads (not assumption):
(1) **Offer `DETAIL_OPEN` events are tagged with the wrong `cityId`** —
`src/app/(public)/[city]/offers/[section]/[slug]/page.tsx:249` passes
`cityId={offer.placeId}` (a Place id) into `AnalyticsDetailBeacon`, not a
real City id; every city-scoped admin-analytics filter/breakdown silently
mis-buckets or drops real Offer view events. Isolated to this one file —
Place's own beacon correctly uses `place.cityId`; the `programs/[slug]`
Offer variant correctly passes `cityId={null}`. (2) **Phone/contact-reveal
CTA — a signal category this task explicitly names — is completely
untracked** despite being a real, live action: the shared `CallActionButton`
(`src/components/shared/CallActionButton.tsx`, used by both Place's
"Позвонить" button in two page variants — premium `PlaceSidebarCard.tsx`
and marketplace `PlaceHero.tsx` — and Event's `EventDecisionPanel.tsx`) has
no analytics call at all. (3) **Offer's primary CTA (book/call,
`OfferPageView.handlePrimary`) fires zero analytics** — confirmed the real
production render path (`[city]/offers/[section]/[slug]/page.tsx:259`) uses
no `onPrimary` override, so this default handler is what actually runs; Offer
already has `SAVE` tracked but not its main conversion action. (4) **Place's
"Сайт"/Instagram link CTAs are untracked** — same shared-component pattern
(`SidebarCardContactRow` in `src/components/shared/SidebarCard.tsx`, used by
both Place variants) has no onClick hook. (5) Content Performance's derived
"Open %" column reads as misleading 0% for Place/Offer/Article (no
`CARD_VIEW`⇒`views` always 0 for those types) even though the raw `Opens`
column (from `DETAIL_OPEN`) is real and correct — a cosmetic derived-metric
issue, not a missing-data one (BACKLOG-026). (6) `Article.views` is a second,
uncorrelated raw counter parallel to `UserEvent`, pre-existing, not read by
any admin dashboard (BACKLOG-027). (7) `PAGE_VIEW`/`UNSAVE`/`PLAN_REMOVE`
enum values defined, never emitted (BACKLOG-028). (8) No `SHARE` signal
despite live Share UI on Route/Place/Article — would need a new enum value
+ hand-written migration, deferred (BACKLOG-029). (9) `/business/analytics`
is a 14-line "Раздел в разработке" placeholder — explicitly allowed to
defer per this task's own §18 guidance since `/business/dashboard` already
covers real, correctly-scoped per-publication data (BACKLOG-030). (10)
`/api/publication-stats/[entityId]` unconditionally returns
`buildEmptyPublicationStats()` (self-documented in code: "реальный
агрегатор ещё не подключён") behind a full, production-ready admin+business
UI (period switcher, 8 sections) — an **honest empty state**, not fake data,
so it does not violate the "no fake analytics" hard requirement; redundant
with the already-working Content Performance dashboard (BACKLOG-031). (11)
Zero test coverage existed anywhere in the analytics stack before this
session (services, routes, components) — addressed minimally in
IMPLEMENTATION/VERIFICATION below, not left to backlog, since Exit
Criterion 11 requires "relevant tests green."
MISSING — No dedicated event-warehouse/streaming infra (correctly not
needed at this scale — `UserEvent` + on-the-fly aggregation is adequate,
matches "do not build a data platform"). `CARD_VIEW` impressions for
Place/Offer listings (BACKLOG-032, explicitly optional per this task's own
"impression not automatically mandatory" guidance). `SAVE`/`PLAN_ADD` for
Route (BACKLOG-033, small/secondary entity). Rate limiting on the ingestion
endpoint (BACKLOG-034 — deliberately not added: the repo's only reusable
limiter is Postgres-backed and would double the write cost of every
analytics event, directly against this task's server-cost principle; not a
proven abuse vector at current scale). Scheduled recompute of
`UserBehaviorProfile.segmentKeys` for inactive users (BACKLOG-035, Task
5-adjacent, out of Task 3's view/CTA measurement scope).
DO NOT TOUCH — `UserEvent` schema/ingestion pipeline; `DETAIL_OPEN`/
`CARD_VIEW`/`SAVE`/`PLAN_ADD` emitters that already work correctly;
`UserBehaviorProfile`/`SegmentResolverService` aggregation internals; the
entire `/admin/analytics` 5-tab dashboard suite and its 6 backing API
routes (real, RBAC-correct, no mock data); `/business/dashboard`'s
per-publication table and its server-side business scoping;
`getBookingAnalytics`; `SearchQueryLog`/search analytics (Task 2, out of
this task's boundary per §24 of this task's own instructions).
IMPLEMENTATION SCOPE: (a) fix the confirmed Offer `cityId` correctness bug
— one file, switch to the same `citySlug` fallback resolution already built
into `trackUserEvent`/`resolveCityId`, zero schema change; (b) add
`CTA_CLICK` tracking for the 3 confirmed live-but-untracked CTA categories
(phone/contact-reveal, website link, Offer primary action) by adding a
single optional `onClick` hook to the 2 already-shared, already-reused
components (`CallActionButton`, `SidebarCardContactRow`) and wiring it from
the 4 call sites that have the needed entity context in scope, plus one
direct `postAnalyticsEvent` call in `OfferPageView.handlePrimary` matching
the exact pattern already proven in `EventPageView.handlePlan/handleBuy`;
(c) add critical tests per §29 (event ingestion validation, content-
performance aggregation correctness including the cityId fix, business
isolation). No schema/migration, no new model, no new dependency, no new
analytics pipeline — 100% reuse of the existing `UserEvent`/`trackUserEvent`/
`postAnalyticsEvent`/`CTA_CLICK` machinery.
GAPS: All P1 gaps from IMPLEMENTATION SCOPE closed this session (see
IMPLEMENTATION/VERIFICATION below). Remaining findings are P2/P3, routed to
`docs/engineering/backlog.md` (BACKLOG-026 through BACKLOG-036) — none
blocks Task 3's Exit Criteria, none reopens Task 1/2.
IMPLEMENTATION: `AnalyticsDetailBeacon` on the Offer city-scoped detail page
now passes `citySlug` instead of the wrong `cityId={offer.placeId}`
(`src/app/(public)/[city]/offers/[section]/[slug]/page.tsx`). `CallActionButton`
and `SidebarCardContactRow` (`src/components/shared/`) gained a backward-
compatible optional `onClick` hook, wired from 4 call sites that already had
the needed entity context: `PlacePhoneActions.tsx`/`PlaceSidebarCard.tsx`
(premium Place), `PlaceHero.tsx` (marketplace Place, phone+website+
Instagram), and `EventDecisionPanel.tsx` (Event phone CTA, the one gap in
an otherwise-tracked Event CTA surface). `OfferPageView.handlePrimary`
(Offer's main book/call CTA) now fires `CTA_CLICK` directly, matching
`EventPageView.handleBuy`'s exact existing pattern. `PremiumPlacePage.tsx`
threads `placeId` into `PlaceSidebarCard` (new required prop; only caller
updated, confirmed via grep). No schema/migration, no new dependency.
COMMITS: `8f3f9383` (fix: Offer cityId correctness), `7077f8f0` (feat:
CTA_CLICK tracking for phone/website/Instagram/offer CTAs), `56c1727f`
(chore: critical analytics tests).
VERIFICATION: `npx tsc --noEmit` clean (whole repo). `npx eslint` on all
9 changed/new application files: 0 errors (7 pre-existing warnings on
unrelated lines, none introduced by this diff — confirmed by reading each
warning's line against the diff). `git diff --check` clean. Full `pnpm
check:push` (`pnpm build`) — exit 0, full route manifest compiled. 3 new
targeted test files, all passing against the real local dev DB
(`npx tsx <file>` per this repo's convention): `/api/analytics/events`
ingestion validation (invalid eventType/oversized meta/malformed JSON all
correctly rejected without writing a row); `analyticsContentPerformance`
aggregation (written DETAIL_OPEN/CTA_CLICK/SAVE counts match exactly what
the admin dashboard's real query returns; citySlug→cityId resolution,
the same fallback the Offer cityId fix now depends on, proven end-to-end);
business publication-performance isolation (`getPerformanceMetricsByEntity`
never returns a foreign entity's metrics when not explicitly requested —
the mechanism `getBusinessWorkspaceData`'s server-side businessId/
ownerUserId scoping relies on). Controlled proof against the real local
dev DB + running dev server (Place "«Молекула»", real published entity,
via the Browser pane): baseline `DETAIL_OPEN=21, CTA_CLICK=0` → one fresh
full-page reload → `DETAIL_OPEN=22` (exactly +1, confirming one open per
real page load, no double-count) → clicked the newly-tracked "Позвонить"
button (`ref_13`, real `tel:` link) → network tab showed
`POST /api/analytics/events → 200` → DB confirmed `CTA_CLICK=1` with
`meta: {source:"detail", targetAction:"call"}`, exactly matching the new
code. (Mid-proof, the local Postgres/Docker daemon briefly became
unresponsive — a host-level Docker Desktop hiccup, confirmed via
`docker exec ... pg_isready` and even `docker inspect` timing out/erroring
independent of this session's code; waited for recovery rather than
treating it as a code defect; DB was healthy again within minutes and the
proof completed cleanly.)
DEV SMOKE: Not yet performed on actual `dev.mamago.by` — pending owner
deployment per the standing DEPLOYMENT LOOP process (this agent does not
deploy). Local dev-server + local dev-DB verification above stands in for
the pre-deploy portion; the deployed-DEV portion (repeat the same
open→CTA-click proof against `https://dev.mamago.by`, plus an authenticated
`/admin/analytics` Content Performance check if the owner logs in) remains
open.
BLOCKERS: None code/logic-side. Deployment-dependent final smoke requires
owner-controlled DEV deploy via Telegram (per standing process) before this
task can move to `COMPLETE`.
BACKLOG/NOTES: BACKLOG-026 (misleading 0% Open Rate for Place/Offer/Article
in admin Content Performance — raw Opens/Saves/CTA numbers remain correct),
BACKLOG-027 (`Article.views` parallel counter, pre-existing), BACKLOG-028
(dead `PAGE_VIEW`/`UNSAVE`/`PLAN_REMOVE` enum values), BACKLOG-029 (no
`SHARE` signal — needs new enum value/migration), BACKLOG-030
(`/business/analytics` empty placeholder — explicitly deferrable per this
task's own §18), BACKLOG-031 (`/api/publication-stats/[entityId]` honest-
empty stub, redundant with the working Content Performance dashboard),
BACKLOG-032 (`CARD_VIEW` impressions missing for Place/Offer listings —
explicitly optional per this task's own guidance), BACKLOG-033 (Route
`SAVE`/`PLAN_ADD` untracked), BACKLOG-034 (no rate limiting on the
ingestion endpoint — deliberately not added, would double write cost),
BACKLOG-035 (`recomputeAllBehaviorSegments()` has no scheduled caller),
BACKLOG-036 (new Place CTA_CLICK events lack cityId — this session's own
minor follow-up). None blocks Task 3's Exit Criteria.

MVP PUBLICATION ANALYTICS DRILL-DOWN (2026-08-09, Claude Code — owner
follow-up decision: complete Task 3 with a per-publication interaction
report + comparable core impression metrics, then freeze analytics scope
for MVP; `d2cfb23c` preserved, not deployed until this lands):
IMPLEMENTATION — reused the existing `UserEvent` pipeline exclusively, no
new analytics system: (1) new `getPublicationAnalyticsDetail()`
(`analyticsContentPerformance.service.ts`) — a bounded aggregate query
scoped to one `entityType`+`entityId`+period+optional city (indexed on
`[entityType,entityId,createdAt]`), returning counts/rates/CTA breakdown
only, never raw `UserEvent` rows/userId/sessionId/IP/UA; (2) new RBAC-gated
route `GET /api/admin/analytics/content-performance/[entityType]/
[entityId]` (`requireRole([ADMIN,MODERATOR])`, identical pattern to its 6
sibling admin-analytics routes); (3) centralized Russian CTA
`targetAction` → label mapping (`src/lib/analytics/
ctaTargetActionLabels.ts`) — known values (`call/website/instagram/buy/
plan/primary/book`) get real labels, unknown/future values degrade to a
readable `Действие «…»` fallback, never raw JSON, never silently dropped;
(4) new `PublicationAnalyticsDrawer`/`PublicationAnalyticsDetails`
(`src/components/admin/analytics/`) reusing the exact same
`ResponsiveOverlay` (desktop Dialog / mobile Sheet) + lazy-load-on-open
pattern already proven by `PublicationStatsDrawer` — deliberately a new,
separate, small drawer rather than extending the existing
`PublicationStatsDrawer`/`/api/publication-stats` (per instruction: do not
expand that parallel, still-stub feature); (5) `AdminAnalyticsContentPerformance.tsx`
table rows are now clickable (row click + an explicit "Подробнее" button,
`e.stopPropagation()`'d, for keyboard/screen-reader access) — existing
sort/pagination untouched; (6) closed the confirmed BACKLOG-026 gap:
`openRate`/`saveRate`/`planRate`/`clickRateVsOpens`/`clickRateVsPlans`
are now `number | null` end-to-end (service, types, `pickBest`/
`worstConverters`/`sortRows`/both comparison builders, the new detail
endpoint) — `null` renders as `—`, never a fabricated `0.0%`; (7) audited
real listing/card surfaces for Place/Offer/Article and wired the existing
`AnalyticsCardViewTracker` onto every real one found for Offer
(`[city]/programs/page.tsx`, homepage "Занятия" row) and Article (`/blog`
journal index — featured + list, homepage "Статьи и обзоры" row);
`listCityHomeArticles.ts` gained the article's own `id` (previously not
even selected — a real gap this surfaced). Place confirmed to have **no**
public listing/catalog surface at all (routing audit: `/[city]/places`
has only `[slug]`, no listing page; no PlaceCard usage anywhere in
`src/app/(public)`) — nothing legitimate exists to wire, not fabricated;
recorded honestly rather than invented. Event/Route's own existing
tracking untouched, per instruction.
CTA TARGETACTION CATEGORIES FOUND (live grep of every `targetAction:`
call site, cross-checked against real local DB data): `call` (phone
reveal — Place/Event), `website`/`instagram` (Place), `buy` (Event ticket
purchase), `plan` (Event "add to plan" CTA click), `primary` (Offer main
booking/call CTA). `book` exists in code but is emitted on
`BOOKING_CREATED`, not `CTA_CLICK` — confirmed via source read, does not
pollute the CTA breakdown. Real historical data on a live article (24
pre-existing `CTA_CLICK` rows from the continuous-reading tracker,
predating `targetAction`) correctly bucketed to "Без указания действия"
by the new grouping — proves the null/fallback path against real data,
not just fixtures.
API/QUERY COST: detail endpoint is 3 small queries (one indexed
`groupBy`, one indexed raw `GROUP BY` for the CTA breakdown, one
`loadAllEntityTitles` reuse) fired only when an admin opens a specific
row (lazy-loaded, per instruction — no N+1 on the main table, no
eager-loaded per-row detail). No new write path, no new high-frequency
event — the only new writes are the same cheap, already-proven
`CARD_VIEW` fire-once-per-exposure pattern, now reaching 2 more real
surfaces.
PRIVACY/RBAC: detail response shape contains no userId/sessionId/IP/UA/
raw events (test-verified, see below); RBAC identical to the 6 existing
sibling admin-analytics routes (ADMIN/MODERATOR only); no new public
endpoint.
CONTROLLED PROOF (local dev DB + running dev server, Browser pane,
2026-08-09): real published article "Чем заняться на зимних каникулах"
(`cms37q1ca0006ws27z75ug52h`) on real content — baseline `CARD_VIEW=4,
DETAIL_OPEN=67, CTA_CLICK=24` → visited `/minsk/blog` (real featured-card
exposure, ~60% viewport-visible, confirmed via DOM geometry read) →
`CARD_VIEW=5` (exactly +1, correct `meta: {source:"listing",
section:"journal", position:"featured"}`, correct resolved `cityId`) →
opened the article detail page → `DETAIL_OPEN=68` (exactly +1). Cross-
validation: called `getAnalyticsContentPerformance()` and
`getPublicationAnalyticsDetail()` directly for the same entity/period —
**numbers agreed exactly** (views/opens/ctaClicks all matched between the
existing trusted Content Performance table and the new detail endpoint).
No double-count observed on repeated navigation/HMR reloads during the
session.
TESTS: extended `analyticsContentPerformance.service.test.ts` (existing
file from the earlier Task 3 phase) with 4 new cases, all passing against
the real local dev DB: per-entity aggregate correctness (impressions/
opens/saves/planAdds/ctaClicks + all 4 rates match hand-computed values);
CTA targetAction grouping + unknown-value fallback (readable, non-JSON,
not silently dropped) + null-action bucket; no-PII assertion (JSON-
serialized response checked for absence of a planted fake sessionId, and
for absence of `userId`/`sessionId`/`ip`/`userAgent`/`events` keys
entirely); zero-denominator semantics (measured-zero `0` vs unmeasured
`null`, both distinguished correctly). No dedicated route-level test for
the new API route's RBAC, matching the harness limitation already
documented for its 6 sibling routes (`getCurrentUser()`/`cookies()`
throws outside a real Next.js request scope when invoked directly) —
RBAC correctness instead rests on identical-pattern reuse, verified by
direct source comparison. Re-ran all pre-existing analytics/search tests
(ingestion, business isolation, search word-order) — no regressions.
GATES: `npx tsc --noEmit` clean (whole repo, twice — before and after the
final edits); `npx eslint` on all 14 changed/new files — 0 errors (3
pre-existing `<img>`-vs-`<Image>` warnings, none introduced); `git diff
--check` clean; full `pnpm build` — exit 0, "Compiled successfully in
2.6min", full 386-page route manifest generated with no errors.
BACKLOG: BACKLOG-026 marked RESOLVED. BACKLOG-032 marked PARTIALLY
RESOLVED (Offer+Article done, Place blocked on a Place listing surface
existing at all — not an analytics gap). No new scope taken on beyond
this follow-up's explicit brief — Share, Business Analytics redesign,
publication-stats parallel feature, Route save tracking, warehouse,
cohorts, and exports all explicitly left alone, per instruction §16/§17.
COMMITS: `f84e081c` (feat: aggregate service + API + nullable rates),
`256e279a` (feat: admin drill-down UI), `588e21b1` (feat: impression
tracking for Offer/Article listing surfaces), `f37937d8` (chore: tests).

BUSINESS ANALYTICS MVP (2026-08-09, Claude Code — owner reopened Task 3
before deployment: `/business/analytics` was still the "Раздел в
разработке" placeholder; the earlier MVP drill-down follow-up above covered
only Admin):
IMPLEMENTATION — Moved `PublicationAnalyticsDrawer`/`PublicationAnalyticsDetails`
from `components/admin/analytics` to the neutral `components/analytics`
(alongside `AnalyticsDetailBeacon`/`AnalyticsCardViewTracker`) and added a
`fetchBasePath` prop, so Admin and Business share the exact same drill-down
report component/fetch/loading/error handling — no second implementation.
Extended `getPerformanceMetricsByEntity()` (already powering the Dashboard's
Top-5) with `opens` (`DETAIL_OPEN`, previously untracked there), an optional
`places` param, and an optional `dateRange` filter — all additive, the
Dashboard's own all-time call is unchanged. Added
`getBusinessPublicationsPerformance()` (full list, not top-5, of a
business's own Event/Offer/Place with real metrics, reusing the exact same
ownership queries as `getBusinessWorkspaceData`). Publication types: Event
and Offer per instruction; Place included too after confirming its
ownership query is already identical/free (same `ownerBusinessId`/
`createdByUserId` OR-pattern already used elsewhere in this same file) —
no scope expansion. Article/Route excluded — businesses do not own them in
the current model.
OWNERSHIP (mandatory) — New `businessOwnsPublication()`
(`src/server/services/business/businessAnalyticsAccess.ts`): every business
analytics detail request re-verifies server-side, from the authenticated
session's own business, that the client-supplied `entityId` actually
belongs to that business, before any `UserEvent` aggregation runs. Mirrors
the exact existing ownership rules (`canManageActivityById`-equivalent for
Event; `src/app/api/business/offers/[id]/route.ts`'s
`place.ownerBusinessId`/`createdByUserId` pattern for Offer; Place's own
fields) rather than inventing new rules. Foreign or nonexistent publication
→ 404, zero metric leakage (never a 200 with empty/zeroed data, which would
itself confirm/deny existence).
NEW ENDPOINTS — `GET /api/business/analytics/publications` (the business's
own list, `getCurrentUser()`+`getMyBusiness()`, same pattern as
`/api/business/bookings/analytics`); `GET /api/business/analytics/
publications/[entityType]/[entityId]` (ownership-checked drill-down,
reuses `getPublicationAnalyticsDetail()` — the exact same aggregate/CTA-
label mapping already built for Admin — only after ownership passes).
UI — `/business/analytics` (`src/app/business/(protected)/analytics/
page.tsx`) replaced; `BusinessAnalyticsClient.tsx`: 5-option date range
(same canonical ranges as Admin), row list with real Показы/Открытия/
Сохранения/В план/Целевые действия, row click opens the shared drawer.
Entirely Russian, no audience segmentation, no cross-business comparison,
no new BI charts — aggregate counts only, matching the "answer 5 questions"
brief. Dashboard's `TopPublicationList` gained one "Вся аналитика" link to
`/business/analytics` — Dashboard itself otherwise untouched (still all-
time Top-5, as before).
PRIVACY — Same `getPublicationAnalyticsDetail()` shape as Admin: aggregate
counts only, no `userId`/`sessionId`/`ip`/`userAgent`/raw event rows ever
in the response (proven by the existing no-PII test, reused unmodified
since the response shape is identical for both callers).
TESTS — `businessAnalyticsAccess.test.ts` (new): real two-business fixture
(separate owner/business/place/event/offer each) — own Event allowed, own
Offer allowed, own Place allowed, foreign Event rejected, foreign Offer
rejected, foreign Place rejected, nonexistent entityId rejected, Article/
Route always rejected even when reusing a real id of a different type (no
type-confusion leak). `businessWorkspace.service.test.ts` (extended):
`opens` tracked correctly, `places` param honored, `dateRange` correctly
excludes a year-old event from a 24h-scoped query. All existing analytics
tests re-run — no regressions.
GATES — `npx tsc --noEmit` clean (whole repo). `npx eslint` on all 12
changed/new files — 0 errors, 0 new warnings. `git diff --check` clean.
Full `pnpm build` — exit 0, "Compiled successfully in 106s", full route
manifest generated including `/business/analytics`, `/api/business/
analytics/publications`, `/api/business/analytics/publications/
[entityType]/[entityId]` — no errors.
BACKLOG — BACKLOG-030 → DONE.
COMMITS: `ff2d54b8` (refactor: share drill-down UI), `1866b5b4` (feat:
ownership-verified service + API), `51b5c9fe` (feat: Business Analytics
MVP page), `18340b9e` (chore: ownership isolation tests).
DEV SMOKE: **Complete — verified live on actual deployed DEV
(`admin.dev.mamago.by`/`business.dev.mamago.by`/`dev.mamago.by`) at SHA
`5bdb6be9`, 2026-08-09/10, owner pre-authenticated Admin + Business
sessions in the Browser pane.**
Admin — Content Performance tab: real table (8 entities, real titles,
`Views/Opens/Saves/Plan/CTA` all real, e.g. Малберри Клаб `opens=9`,
«Гранд Бублик» article `opens=11, ctaClicks=20`); `Open %` correctly
renders `—` (not `0.0%`) for every Place row with `views=0` (6/8 rows) —
the exact BACKLOG-026 behavior. "Подробнее" opened the shared drawer:
correct title/type ("Место"/"Статья")/city ("Минск")/period
(`11.07.2026 — 10.08.2026`); metrics tiles matched the table row exactly;
Конверсия correctly split measured-zero (`0.0%`) from unmeasured
(`—`, e.g. "Открытие / показ" for the zero-impression Place). CTA
breakdown: «Гранд Бублик» (20 real clicks, all pre-existing continuous-
reading events with no `targetAction`) rendered "Без указания действия:
20" — honest, not fabricated, not dropped. No raw JSON/PII visible
anywhere. Changed date range to "Today": table correctly re-scoped to 2
entities; drill-down re-opened for the same Place showed the updated
period (`09.08.2026 — 10.08.2026`) and updated counts — period change
propagates correctly. Sorting by CTA column re-ordered the table
correctly (descending CTA first).
Business — `/business/analytics`: real page, not the placeholder; real
list for the authenticated business — Place ("«Кофта» на пр-т Мира, 1»",
PUBLISHED) and multiple Offers (DRAFT), each showing real Показы/
Открытия/Сохранения/В план/Целевые действия; 5-option date range present
and functional; drill-down opened (desktop) rendering the identical
shared report format as Admin (title/"Место"/period/5 metrics/Конверсия
with correct `—`/`0.0%` split/Целевые действия). Entirely Russian, no
segmentation/cross-business data visible.
Ownership isolation (required, confirmed live): captured a real foreign
Place id from Admin's Content Performance
(`PLACE/cmsddc3qw008amk0z2wphx36o`, Малберри Клаб — confirmed absent from
the authenticated business's own list) and requested it directly against
`GET https://business.dev.mamago.by/api/business/analytics/publications/
PLACE/cmsddc3qw008amk0z2wphx36o` → **HTTP 404**, body
`{"error":"Publication not found"}` — zero metric leakage. The same
business's own Place (`cms7ajop1000lwsq2b1jggaww`) → HTTP 200 with real
data, confirming the boundary is precise (not fail-open, not blanket
rejection).
Tracking sanity (live, real deployed writes): baseline for Малберри Клаб —
`opens=9, ctaClicks=0`. Visited the real public place page
(`dev.mamago.by/places/malberri-klab-mulberry-club`) → `DETAIL_OPEN` fired
(`POST /api/analytics/events` → 200) → Admin table `opens` 9→10 (exactly
+1). Clicked the real "Позвонить" (tel:) link → `CTA_CLICK` fired (200) →
Admin table `CTA` 0→1, `CTA/opens` 0%→10.0%; drill-down CTA breakdown
showed **"Позвонили: 1"** — the correct centralized Russian label for a
real `targetAction:"call"` event, live end-to-end on deployed DEV. Also
visited `dev.mamago.by/minsk/blog` (the newly-wired Article listing) →
a second `POST /api/analytics/events` fired 200 (`CARD_VIEW` impression).
No duplicate/double-count observed on any repeated navigation.
Desktop + mobile: Business Analytics confirmed clean at 375×812 (cards
stack correctly, chips wrap, date-range pills wrap to 2 rows, no overflow,
no layout breakage) — mobile drill-down *interaction* (opening the Sheet
variant) could not be exercised due to a Browser-pane tool-level click
timeout specific to the mobile-viewport touch emulation during this
session (no app-side error: no console errors, no failed/5xx requests,
page remained stable and responsive to screenshots throughout); the
identical underlying component (`PublicationAnalyticsDrawer`/
`ResponsiveOverlay`) was fully exercised and confirmed correct on desktop
for both Admin and Business, and `ResponsiveOverlay`'s mobile-Sheet
breakpoint is pre-existing, already-proven infrastructure (same one
`PublicationStatsDrawer` already uses) — not new logic introduced by this
task. Treated as a tool limitation, not an unverified app behavior.
Console/API errors: zero console errors on any page visited. All
`/api/admin/analytics/*` and `/api/business/analytics/*` requests
returned 200 except the one intentional ownership-check 404. One
unrelated `ERR_ABORTED` on a Next.js RSC prefetch during a rapid
navigation (benign soft-navigation-abort pattern, not a real error, not
analytics-specific).
Separately, during this smoke session the owner discovered and fixed an
unrelated DEV environment defect (`OTP_SECRET` not configured, blocking
business-signup phone verification) — resolved for DEV, tracked as
BACKLOG-037 with the PROD-side requirement flagged for Task 14
(Environment Parity); did not block or require any Task 3 code change.
BLOCKERS: none. All required Admin + Business Publication Analytics
checks passed on deployed DEV.

**TASK 3 — COMPLETE.** Deployed SHA: `5bdb6be9`. Publication Analytics
(Admin + Business) is frozen for MVP — further analytics improvements go
to `docs/engineering/backlog.md`, not back into this task. Task 4 not
started. PROD untouched throughout (DEV-only OTP_SECRET fix on the shared
host; no PROD deploy, no PROD data access, no PROD env changes).

AUDIT FIRST existing analytics/tracking infrastructure: `/admin/analytics`,
business analytics, analytics models, impressions, views, unique views, CTA,
saves, My Ideas, My Plan, shares, ratings, reactions, content performance,
retention, storage, abuse protection, existing tests. Core principle:
collect only data actually used by the product, ranking, or business
analytics. Do not build expensive granular tracking "just in case." Do not
create a parallel analytics architecture.

**Exit Criteria:** Publication effectiveness can be assessed via meaningful
engagement data without excessive backend/storage load.

## TASK 4 — Event Wizard Address Dropdown

Priority: `P0`

STATUS: `COMPLETE`
AUDIT: Traced full flow end-to-end (`EventLocationSearchInput` →
`QuickPlaceCreate` → `Step2Location` → `EventFormData.pendingLocation` →
`resolvePendingLocationOnPublish` (publish-time, in-transaction) → `Place`/
`EventVenue` → edit hydration via `mapEventToFormData`). Google Places
autocomplete UI itself (dropdown rendering, `gmp-select` wiring,
`fetchFields`, debounce) was found fully functional — no dropdown-rendering
or form-state bug. mamaGo-internal Place search (`PlaceSearchAutocomplete`)
also fully functional. Compared against the reference implementation (Place
Wizard's `PlaceLocationPicker`/`PlaceSearchInput`): Place Wizard persists
immediately and calls `/api/geo/enrich-location` right after address
selection; Event Wizard defers Place creation to publish time via
`pendingLocation` and never called that enrichment endpoint.
GAPS (root cause, proven not guessed): the human-readable address text and
lat/lng survive correctly end-to-end for a new venue — but `googlePlaceId`
and `addressJson` (Google address components) returned by the selection
callback were silently dropped at two client-side type boundaries
(`QuickPlaceCreate`'s `LocationData` interface, then
`EventFormData.PendingLocation`), and `resolvePendingLocationOnPublish.ts`
hardcoded `googlePlaceId: null`, `addressJson: Prisma.JsonNull`,
`districtAutoId: null`, `metroAutoId: null` when creating the `Place` row —
even though the data existed one layer up. Net effect: every new venue
created through the Event Wizard permanently lost its Google place
identity, structured address components, and auto district/metro (no
crash, no visible blank field — the address text looked fine, which is why
it went unnoticed).
IMPLEMENTATION: (1) extended `PendingLocation` (both
`src/components/business/wizard/event/types.ts` and the duplicate interface
in `src/lib/business/resolvePendingLocationOnPublish.ts`) with optional
`googlePlaceId`/`addressJson`/`districtAutoId`/`metroAutoId`/
`metroAutoDistanceM`; (2) `QuickPlaceCreate.tsx` now calls the existing
`/api/geo/enrich-location` endpoint (same one Place Wizard uses — reused,
not reinvented) right after a Google address selection or map-pin
confirmation, and carries `googlePlaceId`/`addressJson` plus the enriched
city/district/metro through to `onPlaceCreated`; (3) `Step2Location.tsx`
threads those fields into `pendingLocation`; (4)
`resolvePendingLocationOnPublish.ts` now uses them when creating the new
`Place` instead of hardcoded nulls, with a defensive validity check
(district/metro id must still exist and belong to the resolved city at
publish time, since selection and publish can be minutes apart) rather than
trusting stale client-supplied ids blindly.
COMMITS: `de4d694a` (fix: preserve googlePlaceId/addressJson/district/metro
for Event Wizard new venues); `5a5b401b` (docs); `5bd4371b` (fix: pass
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY/MAP_ID as Docker build-args — separate,
DEV-smoke-discovered build-pipeline gap, see DEV SMOKE below). **Deployed
SHA on actual DEV: `5bd4371b`** (`dev-app-1`, image `dev-269`).
VERIFICATION: focused test `src/lib/business/resolvePendingLocationOnPublish.test.ts`
(`pnpm test:event-wizard-pending-location`) — 5 scenarios: NEW_PLACE with
full Google data persists googlePlaceId/addressJson/district/metro;
PARSED_LOCATION (no Google data) keeps prior null behavior, no regression;
stale/cross-city district/metro ids are dropped, not blindly trusted;
EXISTING_PLACE mode unaffected (no Place created); empty/invalid selection
does not create a corrupted Place. `npx tsc --noEmit` clean. Targeted
ESLint on all changed files: 0 new warnings/errors (3 pre-existing unused-var
warnings confirmed present at baseline `HEAD` `baba727c`, unrelated to this
change). `git diff --check` clean. Full `pnpm check:push` (production
build) green.
DEV SMOKE: **Complete — verified live on actual `https://business.dev.mamago.by`
(2026-08-10, real business account, real Minsk addresses via the real Google
Places API, deployed image `dev-269` = SHA `5bd4371b`).**
Mid-smoke discovery (separate from the app-code fix above, fixed the same
session): typing a real address into the Event Wizard's Google field on DEV
produced **no predictions at all** — console: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
is missing`. Verified this was NOT a Task 4 regression by reproducing the
identical failure in the untouched Place Wizard (`PlaceSearchInput` — same
error) and its map-pin fallback (blank map, same error) — proving every
Google Maps feature was broken on every previously-built DEV/PROD image, not
just the new code. Root cause: `Dockerfile`'s `RUN pnpm build:ci` never
received `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`/`NEXT_PUBLIC_GOOGLE_MAP_ID` as
build args — Next.js inlines `NEXT_PUBLIC_*` vars into the client bundle at
`next build` time, not from the container's runtime env (which *did* have
the var set, misleadingly). Fixed: `Dockerfile` (`ARG`/`ENV` for both vars
in the builder stage) + `.github/workflows/docker.yml` (`build-args` now
passes both from GitHub Actions repo secrets — same single key/map-id used
for DEV and PROD builds, per explicit owner decision, no separate DEV/PROD
Google credentials exist yet). Secrets `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and
`NEXT_PUBLIC_GOOGLE_MAP_ID` set from the existing local `.env.local` values
(verified present/non-empty first, values never printed/logged). Committed
`5bd4371b`, pushed, CI green (2m5s), Docker Build & Push green (15m46s,
`dev-269`), owner redeployed `dev-app-1` → confirmed via
`docker inspect` label `org.opencontainers.image.revision` = `5bd4371b`.
Scenario A (existing Place) — created event, selected existing place "SREDA"
from "Мои места", published. DB-verified: `Activity.placeId` →
`cmsddc3ju006amk0zfwir8i83` (SREDA), `EventVenue` correctly linked.
Scenario B (new Place via real Google address, "ул. Октябрьская 16, Минск")
— after the build-pipeline fix, predictions appeared correctly; selected,
saved, published. DB-verified on the actual `Place` row: `googlePlaceId`
`ChIJxXMs2tHP20YRpDz2mLwDp0Q`, `locationSource` `GOOGLE`, `addressJson`
populated, `districtAutoId`/`metroAutoId` resolved (Центральный / м.
Пролетарская, 1006m), `cityId` (Минск), `lat`/`lng` correct — all
previously would have been null/MANUAL. `EventVenue` correctly linked.
Scenario C (edit hydration + address change) — reopened the published
event, Step 2 correctly hydrated the just-created venue including
district/metro; changed address to "ул. Немига 5, Минск", resaved,
resubmitted. DB-verified: a **second** `Place` created with its own correct
`googlePlaceId` (`ChIJAepu4evP20YRJJTmArTmwIA`), district (Центральный),
metro (Немига, 474m), `cityId`; `Activity.placeId` and `EventVenue`
correctly repointed to the new `Place`; the original "Октябрьская 16"
`Place` left untouched (no orphan corruption).
Scenario D (nonexistent address) — both the mamaGo-internal search
("Место не найдено") and the Google field (empty predictions, no crash)
showed a clear no-result state; "Сохранить место" stayed disabled
throughout — no corrupted/partial Place could be saved.
Console/network: confirmed **zero** console errors and zero non-200 network
responses on a freshly-opened tab with the Google widget actively
initialized (prior errors in the same long-lived tab were stale, from
before the build-pipeline fix deployed — reproduced clean on a fresh tab to
rule out stale-log false negatives).
Layout: this session's browser pane rendered at a fixed native 424×808
viewport throughout — narrow enough to double as an informal mobile/narrow
sanity check; Step 2 Location rendered cleanly with no overflow/breakage at
that width across all four scenarios.
Cleanup: all DEV test records created during this smoke deleted after
verification — 2 `Activity` rows, 2 `EventVenue` rows, 2 `Place` rows
(the pre-existing "SREDA" place used for Scenario A was never modified or
deleted, only referenced).
LOCAL MANUAL PROOF (2026-08-10, real dev server + real business account +
real Google Places API against Minsk addresses, local Postgres only — no
DEV/PROD data touched): Scenario A (existing-Place edit hydration) —
confirmed correct on wizard re-open. Scenario B (new venue via Google
autocomplete, "ул. Притыцкого 12") — DB-verified: `Place.googlePlaceId`,
`addressJson`, `locationSource=GOOGLE`, `districtAutoId` (Октябрьский),
`metroAutoId` (Пушкинская, 1047m), `cityId`, `lat`/`lng` all correctly
persisted (previously would all have been null/MANUAL). Scenario C (change
address to "ул. Немига 5" on the same event, resubmit) — DB-verified: a
second `Place` created with its own correct googlePlaceId/district
(Центральный)/metro (Немига, 474m); `Activity.placeId` and `EventVenue`
correctly repointed to the new Place; the original Place left untouched
(no orphan corruption). Scenario D (nonexistent address/place name) — both
the mamaGo-internal search and the Google address field show a clear
"not found" state, "Сохранить место" stays disabled, no corrupted/partial
Place can be saved. All test data (1 Activity, 1 EventVenue, 2 Place rows)
deleted from local DB after verification.
BLOCKERS: none. Task 4 exit criteria all met: address autocomplete works on
actual DEV, new venue from Event Wizard stores correct location (including
googlePlaceId/district/metro), existing venue flow remains correct,
edit/reload round-trip is correct, no malformed/partial Place records were
created in any scenario, focused tests green, full gate green, actual DEV
smoke green after owner-controlled deploy, no unresolved P0/P1 in Task 4.
BACKLOG/NOTES: the `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`/`MAP_ID` build-arg gap
described above was fixed and deployed within this task, not deferred — it
is not a backlog item. Three separate, smaller items remain deferred to
`docs/engineering/backlog.md`
(BACKLOG-038/039/040) — none block this task's exit criteria: (038, P2)
`/api/geo/enrich-location`'s address-component fallback matcher reads the
legacy `long_name` field shape and never matches the new
`PlaceAutocompleteElement`'s `longText`/`shortText` shape (only affects the
fallback path when centroid-based district/metro lookup misses — the
primary path was proven working in both manual scenarios above); (039, P3)
`EventLocationPicker.tsx` is dead code (zero importers), safe to delete;
(040, P3) Place Wizard's `PlaceSearchInput.tsx` still uses the deprecated
Google `Autocomplete` widget (already had its own tracked TODO) while Event
Wizard now uses the modern `PlaceAutocompleteElement` — a drifted
duplicate implementation worth unifying later.

AUDIT FIRST and reproduce the current problem. Check: Event Wizard, Place
selector, existing Place, new Place creation, autocomplete, Google Places
integration, city context, debounce/search, normalization, coordinates,
persistence, edit flow, tests. Find root cause first. Do not rewrite the
address system without necessity.

**Exit Criteria:** The editor reliably finds an address, selects an existing
Place, or creates a new Place inside the Event Wizard.

## TASK 5 — Content Analytics & Ranking

Priority: `P0`

STATUS: `COMPLETE`
AUDIT:
EXISTING — A real, working, shared engagement-ranking layer already exists
and is already reused across the two main discovery surfaces plus My Plan
suggestions, built entirely on Task 3's `UserEvent` log (no parallel
analytics/ranking pipeline): `src/server/discovery/kudaDiscoveryFeed.ts`
(Events "Куда пойти" feed) ranks its DB candidate pool
(`cityId`/status-filtered, `orderBy nextOccurrenceAt/createdAt desc`) by
`getEventEngagementScores()` (`src/server/discovery/
eventEngagementScores.ts`, a single bounded raw-SQL `GROUP BY` scoped to the
candidate `entityId`s — cheap, no full-table scan) + `Occasion.boostScore`
(admin-curated seasonal boost, MAX-aggregated, `src/lib/discovery/
occasions.ts`) + `businessQualityBoost.ts` (merit-based multiplier, up to
×1.10, from booking response/confirm/complete rate, min 5 bookings/30d) + a
weather boost, tie-broken by `dateStart`.
`src/server/services/planSuggestions.service.ts` (My Plan suggestions)
reuses the exact same `getEventEngagementScores()` after filtering
candidates by city + published + `Child`-derived `ageTags` (graceful
OR-fallback to unfiltered if the age filter would return 0 rows — genuine
reuse, not a second engine).
`src/server/discovery/classesDiscoveryFeed.ts` (Offers "Занятия" feed) has
its own, simpler ranking: the real `Boost` model (`Offer.boosts`, an
active-window relation) drives real, live, paid-visibility ranking — any
Offer with an active `Boost` row gets a flat `engagementScore=1000` that
dominates the sort (quality boost is deliberately not applied on top, to
avoid double-boosting); non-boosted Offers get `businessQualityBoost` only
(no `UserEvent`-derived engagement score is used for Offers today — an
asymmetry vs. Events, not a defect). This corrects an earlier pass in this
session's own research that initially concluded the `Boost` model was
unwired into ranking (it had only grepped `contentDependencySummary.
service.ts`'s deletion-dependency count and missed `classesDiscoveryFeed.
ts`'s own `boosts: { where: { startAt: {lte: now}, endAt: {gte: now} } } }`
select + `isBoosted` check) — corrected by direct code read before writing
this section.
`src/lib/search/constants.ts` `SEARCH_BOOST` (Task 2, unchanged) — flat
per-entity-type multiplier + `updatedAt` tie-break, deliberately simple,
already accepted as adequate at current catalog size (~276 published
entities).
Stories rail (`StoriesSection.tsx` + `HomeStoryItem`) is a working editorial
rail by design — ordered by `pinned/placementType/manualOrder/startsAt`,
**no** `UserEvent`/analytics signal, not meant to be signal-ranked.
`StoryIntentConfig.title/enabled/order` (5 legacy intents:
today/tomorrow/weekend/free/breaking_news) is genuinely admin-editable and
live via `/admin/ranking/stories-intents?tab=rules`, with optimistic
concurrency + audit log.
`RankingSettings`/`BoostSettings`/`SearchRankingSettings` (3 admin panels,
`/admin/ranking/weights`, `/admin/ranking/boost`, `/admin/search/ranking`)
are already correctly remediated by a prior 2026-08 session: all three are
self-documented dead in their own handler files, locked to HTTP 403 on any
mutation, with matching amber "does not affect production ranking" banners
— confirmed still accurate, nothing to fix.
Ratings/reactions exist and are live per entity type: `PlaceReview`
(rating+text+moderation+owner reply, Google-sync — Places), `RouteRating`/
`ArticleRating` (like/neutral/dislike, one vote per identifier — Routes,
Articles), `BookingFeedback` (1–5 stars, completed bookings only, feeds
`FEEDBACK_LEFT` into `UserEvent`).
PARTIAL/BROKEN — `UserBehaviorProfile.segmentKeys` (20 rule-based segments,
e.g. `NEW_USER`/`SAVER`/`PLANNER`, recomputed synchronously on every
`UserEvent` write, no cron needed) is fully live and correct but has **zero**
ranking/recommendation readers anywhere in `src/` — every consumer is an
admin analytics dashboard. `Child`-age relevance filters My Plan
suggestions but does not rank within the filtered set (ranking there is
population-level engagement + freshness only); the main Kuda feed takes no
age/family parameter at all (age relevance there is client-side only, per
an existing code comment). `Occasion.boostScore` is applied only to Events,
not Offers/Places/Articles/Routes. `PlaceReview`/`RouteRating`/
`ArticleRating` submissions do **not** emit any `UserEvent` — a real, live
quality signal is invisible to the engagement-ranking engine.
MISSING — No `EventRating`/`OfferRating` model (2 of 5 entity types have no
public rating/reaction mechanism). No ranking signal applied to Place/
Article listings (plain `createdAt`/`updatedAt desc` only; Place also has no
public listing/catalog page at all — pre-existing, BACKLOG-032). No geo-
distance ranking (city scoping is exact-`cityId`-match only; `Place.lat/lng`
used only for map display). No explicit/named cold-start code path (de
facto handled by population-ranked + freshness-tie-broken ordering, which
is reasonable but not designed/tested as such — `NEW_USER` segment sits
computed and unused right next to where it would be consulted). No cron/
scheduled recalculation exists anywhere in this codebase for anything —
correctly not needed here, since engagement scores and behavior segments
are both computed live/on-write against small, indexed, bounded query
shapes at current scale.
DUPLICATED/CONFLICTING (root cause of this task's confirmed P1-adjacent
correction) — `eventEngagementScores.ts` hardcoded its weights inline in
raw SQL (`SAVE=5, PLAN_ADD=4, CTA_CLICK=3, DETAIL_OPEN/PAGE_VIEW=2,
CARD_VIEW=1`) while a second, unused, self-documented-dead weight scheme
(`src/features/discovery/signals/discoverySignalWeights.ts`,
`DISCOVERY_SIGNAL_WEIGHTS`, explicit header: "NOT used in runtime
calculations or feed ranking") sat parallel to it with different values and
zero importers outside its own folder — two disagreeing opinions about
signal weight existed in the repo, only one live. Also found: a second,
fully-built, tested Stories-rail redesign (`resolveStoryRail.ts`/
`loadStoryRailCandidatePool.ts`/`STORY_SLOTS` registry with
`today`/`running`/`lastchance` intents) sits dead in the codebase, never
imported by `CityHomePage.tsx` or any real route — an abandoned in-progress
redesign of the live rail, using a different intent vocabulary. Duplicated
"today/weekend" date-range logic exists independently in
`src/lib/stories/ranges.ts` (Stories) vs. `whenLabel.ts`'s own local
`computeWeekendRange()` (discovery filters) — same concept, two
implementations, zero shared imports.
DO NOT TOUCH — `UserEvent` ingestion (Task 3); `kudaDiscoveryFeed.ts`/
`classesDiscoveryFeed.ts`/`businessQualityBoost.ts`/`Occasion` boost —
real, live, working ranking engines, structurally unchanged by this task
(only the numeric weights `getEventEngagementScores()` plugs in were
corrected — its signature/return type is unchanged, so every caller is
unaffected); `SEARCH_BOOST`/`/api/search` (Task 2, frozen);
`RankingSettings`/`BoostSettings`/`SearchRankingSettings` locks (correctly
inert, already disclosed — reopening "admin-tunable global weights" is
exactly the "ranking → ML platform" scope creep this checklist's §15 warns
against); `StoriesSection.tsx`/`HomeStoryItem`/manual placement admin
(working editorial rail, out of scope); `PlaceReview`/`RouteRating`/
`ArticleRating`/`BookingFeedback` (working UGC features — not touched, not
wired into ranking this task, see IMPLEMENTATION SCOPE below);
`Promotion`/`PromotionAction` billing (real revenue feature, unrelated to
ranking); `UserBehaviorProfile`/`SegmentResolverService` internals (Task 3
— correct as computed, only its "unused for ranking" gap is noted, not its
computation).
P0/P1 FINDINGS: none. The two real discovery surfaces (Events, Offers) and
My Plan suggestions already rank content using a shared, cheap,
understandable `UserEvent`-derived signal — this task's exit criteria was
already substantially met before any code changed. Everything else found
was either already-correctly-locked dead admin scaffolding (no release
risk, already disclosed to admins) or a genuine but non-blocking
signal/consistency gap. Nothing threatens security, data integrity, auth,
or a critical production flow.
PRODUCT DECISION (owner, 2026-08-10): `PLAN_ADD` is a stronger user-intent
signal than `SAVE` (committing an item to a concrete day beats
bookmarking it) — the previous runtime formula had this inverted
(`SAVE=5 > PLAN_ADD=4`). Corrected canonical ladder: `CARD_VIEW=1,
DETAIL_OPEN/PAGE_VIEW=2, CTA_CLICK=3, SAVE=4, PLAN_ADD=5`. Scope explicitly
narrowed by the owner to formalizing/correcting the existing live ranking
system only — no personalization, no new ranking layer, no models, no cron,
no materialized scores, no ML, no admin-tunable global weights, no
ratings/reactions wiring, no Stories-rail changes this task.
IMPLEMENTATION SCOPE: (1) new canonical shared constant
`src/server/discovery/engagementWeights.ts` (`ENGAGEMENT_WEIGHTS`, typed
against the real `UserEventType` enum) with the corrected ladder; (2)
`eventEngagementScores.ts` now builds its SQL `CASE` from that table
(`Prisma.sql`/`Prisma.join` fragment composition) instead of a hardcoded
inline copy — same function signature/return type, zero change to any
caller; (3) removed the dead, conflicting `discoverySignalWeights.ts`
scaffold and its self-contained folder (`src/features/discovery/signals/`
— `index.ts`/`types.ts`/`utils.ts` all existed only to re-export/consume the
now-removed table; confirmed zero importers anywhere outside that folder
before deletion) — one source of truth for engagement weights now exists.
Occasion boost, `businessQualityBoost`, weather boost, freshness tie-break,
existing candidate filtering, and Search Ranking are all untouched. No new
models, no cron, no materialized scores, no ML, no admin-tunable weights.
Ratings/reactions and `UserBehaviorProfile.segmentKeys` deliberately NOT
wired into ranking this task (see BACKLOG-041, BACKLOG-042). The second
dead Stories rail deliberately NOT wired or deleted this task (see
BACKLOG-043) — the live editorial rail is unchanged.
COMMITS: `d5b149bc` (fix: canonical engagement weight table, PLAN_ADD
outranks SAVE; retires the dead `discoverySignalWeights.ts`; adds 4 new
targeted tests).
VERIFICATION: New test `src/server/discovery/eventEngagementScores.test.ts`
(self-contained fixture, created/torn down within the test, real local dev
DB, `npx tsx` per this repo's convention) — 4 cases, all passing: (a)
scoring a fixture entity with one event of every weighted type sums to
exactly `Object.values(ENGAGEMENT_WEIGHTS)`'s total — computed dynamically
from the imported canonical table, not a hardcoded number in the test, so
it fails if the SQL generation ever drifts from the table; (b) a
single-`PLAN_ADD` entity scores strictly higher than a single-`SAVE` entity,
each matching its own canonical weight exactly; (c) an unlisted real
`UserEventType` (`SEARCH_APPLY`) contributes exactly 0 — proves the `ELSE 0`
branch still works and no speculative weight was invented; (d) repeated
calls against unchanged fixture data return identical scores (determinism).
Re-ran the pre-existing `activityVisibilityPhase2.test.ts` (same
`src/server/discovery/` module) — no regression. `Occasion`/
`businessQualityBoost`/weather/freshness composition in
`kudaDiscoveryFeed.ts`/`classesDiscoveryFeed.ts` verified unregressed by
direct code read (not by a new heavy integration test, per §13 risk-based
verification for a small, isolated change): `getEventEngagementScores()`'s
call sites, parameter shape, and return type (`Promise<Map<string,
number>>`) are byte-identical to before — only the numeric values placed in
that map changed, exactly as intended. `npx tsc --noEmit` clean (whole
repo). `npx eslint` on all 3 changed/new files: 0 errors. `git diff --check`
clean. Full `pnpm check:push` (`pnpm build`) run twice — exit 0 both times,
"Compiled successfully in 104s", full route manifest generated, no errors.
`git status --short`/`git diff --cached --name-status` confirmed only the
intended 7 files changed (3 new/modified + 4 deleted), no foreign diff
present or touched.
DEV SMOKE: **Complete — verified live on actual `https://dev.mamago.by`
after owner-confirmed deployment (2026-08-10).** Deployed image confirmed:
`ghcr.io/asoftby/mamago2:dev-270`, OCI `revision` label
`33fdb234c31175e9a3a6573308a285c5e51fbf1d` (exact match to the pushed
commit), read directly from the green `Docker Build & Push` GitHub Actions
run (`31385342913`) — `/admin/system/build` itself exposes no build
SHA/version field (a version-history/changelog editor, not a build-info
page, confirmed by direct visit with a real authenticated ADMIN session),
so this is the same behavioral/pipeline-metadata proof pattern used in
Task 2's closure. `GET /api/health` → `{"status":"ok","db":"ok"}`.
This is a regression smoke (per instruction), not an attempt to prove exact
score ordering through the UI — that is what the targeted DB tests already
prove.
- **Events / «Куда пойти» (`/minsk/kuda`)**: loads and ranks normally — real
  published Event ("С. Кибирова балет «Три поросенка»") renders correctly
  with cover image, price, age label, date; screenshot-verified. All
  network requests 200 except benign `net::ERR_ABORTED` soft-navigation
  aborts (the same pre-existing, already-documented pattern from Task 2's
  own DEV smoke — duplicate in-flight RSC prefetches during rapid
  client-side navigation, not a real error).
- **Classes / Offers discovery (`/minsk/classes`)**: loads normally,
  correctly renders the real empty state ("Пока нет занятий по вашему
  запросу") — confirmed via `/admin/content/offers?status=PUBLISHED` →
  "Предложения не найдены" that DEV genuinely has **zero `PUBLISHED`
  Offers** right now (all existing Offers are `DRAFT`, matching the
  pre-existing migration-era data state) — not a regression, and provably
  cannot be one: `classesDiscoveryFeed.ts` was not touched by this task's
  diff at all (it doesn't even call `getEventEngagementScores()` — its own
  `Boost`-model-driven ranking is separate and untouched).
- **My Plan suggestions**: `GET /api/plan/suggestions?city=minsk` → 200,
  returns the same real published Event, ranked via the corrected
  `getEventEngagementScores()` — confirmed this is the live, deployed,
  canonical-weight code path (not stale), end-to-end, no error. (Date-
  scoped queries for specific days returned an empty list — a pre-existing
  day-availability filter nuance in `listPlanSuggestionsForCity()`,
  unrelated to and untouched by this task's diff, not investigated further
  as it's outside this smoke's regression scope.)
- **Search Ranking**: `GET /api/search?q=три поросенка` → 200, correct
  single real result, unchanged from Task 2's behavior — no regression.
- **Occasion boost / `Boost` / `businessQualityBoost`**: code paths
  structurally untouched by this task's diff (confirmed by direct read,
  see IMPLEMENTATION SCOPE); `kudaDiscoveryFeed.ts` (which composes all
  three on top of the corrected engagement score) rendered its real content
  with zero server errors — the strongest available proof at current DEV
  data volume (no active `Occasion`/`Boost` rows exist right now to
  visually distinguish their effect, consistent with this being a
  regression smoke, not a score-ordering proof).
- **Console/errors**: zero ranking-related errors or 500s anywhere in this
  smoke. One unrelated, pre-existing finding surfaced and investigated for
  due diligence: a `Minified React error #310` fires in the console on
  *every* page visited during this session (`/minsk`, `/minsk/kuda`,
  `/minsk/classes` alike) under the owner's persisted authenticated ADMIN
  browser session — confirmed **not** a Task 5 regression because (a) it is
  identical on non-ranking pages (the plain homepage `/minsk`), (b) this
  task's diff contains zero React/frontend files, and (c) the page still
  renders full, correct content despite it in every case observed. Filed
  as BACKLOG-049 (P2, investigation only, not fixed here) per owner
  direction.
BLOCKERS: none. All required regression-smoke checks passed on deployed
DEV.
BACKLOG/NOTES: BACKLOG-041 (ratings/reviews as ranking input — owner
decided 2026-08-10 this is **not** a raw ranking-boost signal; retitled to
"Design optional quality/trust layer from ratings and reviews," gated on
PROD evidence, updated in place, not duplicated), BACKLOG-042
(`UserBehaviorProfile.segmentKeys` unused for ranking personalization —
deliberately deferred, no `NEW_USER`/`SAVER`/`PLANNER` feed branching this
task), BACKLOG-043 (second dead Stories-rail redesign — needs a separate
owner decision: finish wiring or delete), BACKLOG-044 (`Occasion.boostScore`
only applied to Events, not Offers/Places/Articles/Routes), BACKLOG-045
(duplicated today/weekend date-range logic, Stories vs. discovery filters),
BACKLOG-046 (`StoryIntentConfig.itemLimit`/`allowedTypes` dead sub-fields),
BACKLOG-047 (`SignalDefinition.isFeatured`/`EventCategory.isFeatured` dead
admin flags), BACKLOG-048 (`Plan.hasPriorityBoost`/`PRIORITY_BOOST`
scaffolding with zero callers and zero business-facing marketing surface —
confirmed not currently sold, verified by grep across all business UI/API
directories, so not a false-advertising risk, just dead plumbing),
BACKLOG-049 (`Minified React error #310` reproduces globally on deployed
DEV, ranking and non-ranking pages alike — confirmed not introduced by
Task 5, tested user flows still work, investigation only, not fixed here).
None blocks Task 5's Exit Criteria; none reopens Tasks 1–4.

**TASK 5 — COMPLETE.** Deployed SHA: `33fdb234c31175e9a3a6573308a285c5e51fbf1d`
(image `ghcr.io/asoftby/mamago2:dev-270`). PLAN_ADD now correctly outranks
SAVE in the shared engagement-ranking formula reused by the Kuda discovery
feed and My Plan suggestions; the dead, conflicting weight table is gone;
zero P0/P1 found; ratings/reviews explicitly deferred to an optional
future quality/trust layer per owner decision (BACKLOG-041), not wired
into ranking this task. Task 6 not started. PROD untouched throughout —
DEV-only deploy, no PROD access, no PROD env/data changes.

AUDIT FIRST existing content ranking/engagement infrastructure and its
overlap with Publication Analytics, Search ranking, Stories ranking, content
performance, user signals, My Ideas, My Plan, ratings, reactions. Potential
signals: impressions, CTR, saves, My Plan additions, shares, ratings,
reactions, engagement, recency, geography, family relevance, child-age
relevance, seasonality, freshness, quality, cold start. Do not build
independent analytics/ranking pipelines for Search, Stories, and Content if a
shared signal layer can be used.

**Exit Criteria:** Content is automatically ranked using understandable,
useful, and cheap signals without constant manual management.

## TASK 6 — Article Actions

Priority: `P0`

STATUS: `COMPLETE`
AUDIT: Read-only code audit (models, services, APIs, UI, pending-action,
       analytics enums) confirmed the owner-approved spec's assumptions with
       corrections: `PlanItem` has no `offerId` field at all — the pattern to
       mirror for Article was `placeId` (nullable FK, no defensive wrapper
       needed, unlike `OfferIdea`'s P2021-catch pattern). No shared
       `ArticleCard` component exists — cards are rendered inline in
       `CityHomeContentRows.tsx` (homepage "Статьи и обзоры") and
       `BlogIndex.tsx` (`FeaturedArticle`/`ArticleRow`, reused by both
       `/blog` and `/{city}/blog`). `ArticleMvpView` had no `id`/href prop.
       `BreakingNewsView` had its own bespoke `handleShare()` (native
       share + manual clipboard), not `ShareModal`. `AnalyticsEntityType.ARTICLE`
       already existed; `UserEventType.SHARE` does not (tracked separately,
       BACKLOG-029). Guest pending-action resume (`PendingEntityType`) only
       supported `"activity"`/`"route"` — confirmed the same gap already
       existed for Place (BACKLOG-050, filed, not fixed here). Confirmed via
       live DEV network trace that Activity/Offer/Event cards already have a
       pre-existing per-card `/api/save/status` N+1 (BACKLOG-051, filed, not
       fixed here — Task 6 built the batch mechanism for Article only, per
       spec).
GAPS: `ArticleIdea` model — missing. `PlanItem.articleId` — missing.
      Article support in `idea.service.ts`/`plan.service.ts` — missing.
      `articleId` support in `/api/save/idea`, `/api/save/plan`,
      `/api/save/status` — missing. Batched save-status for Article card
      grids — missing (had to be built new, no existing batch endpoint to
      extend). Save/Share actions on Article cards, standard detail,
      Breaking News detail, continuous reading — missing. `"article"` in
      guest pending-action resume — missing.
IMPLEMENTATION: Hand-written migration `20260811120000_add_article_actions`
      (`ArticleIdea` model mirroring `PlaceIdea`; `PlanItem.articleId`
      nullable FK, `ON DELETE SET NULL`) — applied to DEV via
      `prisma migrate deploy`, schema validated. `idea.service.ts`:
      `addArticleIdea`/`removeArticleIdea`/`hasArticleIdea`/
      `hasArticleIdeasBatch`. `plan.service.ts`: `addArticlePlanItem`
      (dedupes by user+article, clears competing entity fields on update,
      mirrors `addPlacePlanItem`)/`listArticlePlanItemsBatch`. Extended
      `/api/save/idea` (POST+DELETE), `/api/save/plan` (POST), `/api/save/status`
      (GET) with an `articleId` branch each, emitting `SAVE`/`PLAN_ADD`
      `UserEvent`s with `entityType: "ARTICLE"`, `section: "journal"` (matches
      the existing Article analytics convention, not the spec's literal
      `"articles"` — see VERIFICATION). New bounded batch endpoint
      `POST /api/save/status/articles` (dedup, cap 40 ids, user-scoped, one
      query pair via `hasArticleIdeasBatch` + `listArticlePlanItemsBatch`) —
      the smallest-reasonable mechanism Task 6's own spec required to avoid
      N+1 on Article listing cards. `PendingEntityType` extended with
      `"article"`; `executePendingPostAuthAction` gets `save_idea`/`save_plan`
      article branches; `SaveActivityFlowAdaptive` generalized from a
      hardcoded `entityType: "activity"` to accept `pendingEntityType`/
      `pendingEntityId` props (back-compat default `"activity"` +
      `activityId`, so no existing caller changed behavior). New
      `ArticleSaveHeart` (icon variant for cards with `skipOwnFetch`/
      `initialStatus` batch-driven mode; labeled variant for detail),
      `useArticleSaveStatusBatch` hook, `persistArticleSave.ts`,
      `ArticleDetailActions` (Heart+"Сохранить" + Share2+"Поделиться",
      reusing the existing `ShareModal`). Wired into: homepage journal row
      (`CityHomeContentRows.tsx`), `/blog` + `/{city}/blog`
      (`BlogIndex.tsx` — `FeaturedArticle` + `ArticleRow`, both routes share
      this component), standard Article detail (`ArticleMvpView`, both
      `/blog/[slug]` and `/{city}/blog/[slug]`), continuous reading (each
      loaded article in `ContinuousArticleReader` gets its own `articleId`/
      `href` — independent React state per article, no bleed), and Breaking
      News detail (`BreakingNewsView`'s `NewsHero` — bespoke share handler
      replaced with `ArticleDetailActions`, dead `copied`/`handleShare` code
      removed). Cards use the sibling-overlay pattern (Heart positioned via
      an absolutely-positioned sibling `div`, never nested inside the
      article `<a>`) matching the existing `ActivityCard` convention.
COMMITS: `d923e1f6` — feat(article): add Save (Ideas/Plan) and Share actions
      across all article surfaces (implementation; deployed and smoked,
      closes Exit Criteria). `3b3c13d5` — docs closure for the above.
      Post-smoke, owner-requested UI-only visual refinements (do not
      reopen Task 6 — see BACKLOG/NOTES): `e4a1b6bb` — revert homepage
      journal card to its pre-Task-6 implementation, remove the `/blog`
      row's circular arrow and move Heart into that slot. `d8be9416` —
      resize the homepage journal rail to 5 cards matching the Events
      rail's rhythm, restore the Heart action, fix the card-width flex
      nesting bug that was the actual cause of the "tail" artifacts.
      `9decd216` — anchor the homepage Heart to the cover (not the outer
      card) and add real Article-category metadata between cover and
      title. All 3 pushed to `dev`; not yet owner-deployed as of this
      checklist update.
VERIFICATION: `test:article-actions` (new) — `parseArticleIdsForBatch` unit
      tests (dedup/cap/invalid-input), `executePendingPostAuthAction` article-
      branch tests (fetch-mocked, confirms correct endpoint+payload routing,
      confirms the pre-existing activity branch is unaffected), and a real-DB
      integration test (`articleSaveActions.test.ts`: idea add/remove/
      idempotent/cross-user-isolation, plan add/dedupe/clears-competing-
      fields/cross-user-isolation, batch idea+plan checks, ownership-checked
      remove, invalid-article-id rejection) — all green. `npx tsc --noEmit`
      clean. Targeted `eslint` on every touched/new file clean (one genuine
      bug caught and fixed pre-verification: `react-hooks/set-state-in-effect`
      in `useArticleSaveStatusBatch`, fixed by gating the returned value
      instead of resetting state synchronously in the guard branch).
      `git diff --check` clean. `pnpm check:push` (full production build)
      green, zero errors, full route manifest generated. Local browser
      verification against the real local DEV DB (authenticated real user
      session): homepage + `/minsk/blog` — confirmed via DOM inspection the
      Heart button is a sibling of the article `<a>` (no illegal nested-
      interactive markup), labeled "Сохранить статью" (generic save, not
      "В идеи"), no Share icon on cards; confirmed via `read_network_requests`
      in a **fresh tab** (to rule out soft-navigation log accumulation) that
      exactly one `POST /api/save/status/articles` batch call fires per page
      load and **zero** per-card `GET /api/save/status?articleId=...` calls —
      the N+1 this task was required to avoid. Clicked the Featured Article
      Heart → chooser opened (date picker + "Сохранить в идеи", not a direct
      Ideas toggle) → chose "Сохранить в идеи" → `POST /api/save/idea` fired
      → Heart label changed to "Изменить сохранение статьи" → success view
      showed "Убрать из идей"/"Запланировать"/"Все мои идеи" — full save
      flow confirmed end-to-end, then cleaned up (`DELETE /api/save/idea`,
      confirmed `isSaved:false` after). Article detail
      (`/minsk/blog/chem-zanyatsya-na-novogodnih-kanikulah`) — confirmed
      "♡ Сохранить" + "↗ Поделиться" both render; clicked Share → `ShareModal`
      opened with correct Telegram/WhatsApp links carrying the exact article
      URL + title. Confirmed via `data-article-id` DOM inspection that this
      same page renders through `ContinuousArticleReader` (continuous reading
      is live for this article — category "podborki" is active/non-archived)
      with exactly 1 Save + 1 Share button correctly scoped to that article's
      id; could not live-verify the *second* loaded article's independent
      Save/Share (IntersectionObserver-driven prefetch didn't trigger via
      simulated scroll in this session) — verified by code inspection instead
      (each loaded article gets its own `articleId`/`href` props, in its own
      keyed wrapper div, so React scopes state independently by construction).
      Breaking News detail could not be live-verified — **zero** Breaking
      News articles exist in the local DEV dataset (confirmed via direct
      query); verified by code inspection only (props threaded, bespoke share
      handler removed cleanly, `eslint`/`tsc` clean). Guest pending-action
      resume could not be live-verified in-browser — the session cookie is
      httpOnly (can't be cleared via `document.cookie` to simulate logout
      without a real logout, which would disrupt the owner's persisted DEV
      session) — verified via the `executePendingPostAuthAction` unit tests
      instead, which exercise the exact new "article" branch added.
DEV SMOKE: Deployed-DEV smoke on `d923e1f6`/`3b3c13d5` completed and
      confirmed green by the owner — this closes the items this session's
      own local-DEV verification could not reach (Breaking News detail, no
      seeded content in local DEV; guest pending-action resume, could not
      simulate logout against the owner's persisted session; continuous-
      reading second-article scroll). The owner's deployed-DEV pass is
      recorded here as owner-confirmed, not independently re-observed by
      this session — the concrete, directly-observed evidence remains what's
      documented above under VERIFICATION (local-DEV browser + code
      inspection + unit tests). Task 6 Exit Criteria are met; status is
      `COMPLETE`, no outstanding deployed-smoke gap remains.

      Post-smoke (does not reopen Task 6): 3 UI-only visual-refinement
      commits (`e4a1b6bb`, `d8be9416`, `9decd216` — see COMMITS) are pushed
      to `dev` but not yet owner-deployed. Once deployed, only a **targeted**
      visual check of the homepage Article card is required — not another
      full Task 6 smoke: 5-card desktop layout, Heart inset into the cover,
      real-category rendering when present, no vertical tails, Heart opens
      the Save chooser without navigating, mobile/narrow layout.
BLOCKERS: none.
BACKLOG/NOTES: Filed BACKLOG-050 (Place/Offer guest pending-action resume
      gap, pre-existing, confirmed not fixed here), BACKLOG-051 (pre-existing
      per-card `/api/save/status` N+1 on Activity/Offer/Event grids, confirmed
      live, not extended to fix here), BACKLOG-052 (global Share consolidation
      — `ShareSheet.tsx`/Route detail untouched), BACKLOG-053 (cross-entity
      Save/Share design-system normalization to the pattern this task
      established, explicitly deferred per the owner's own product decision),
      BACKLOG-054 (found incidentally: local dev DB has two migrations
      applied — `SearchDocument.cityId`/`SearchQueryLog` fields — from commit
      `98390674` on unmerged branch `recovery/main-wip-snapshot-2026-08-07`,
      not present in `dev`'s `prisma/schema.prisma`; confirmed zero
      file/table overlap with this task's migration, left untouched per
      foreign-work-in-progress rule, needs an owner decision). Corrected
      BACKLOG-029's now-stale Context line (claimed `BreakingNewsView` used
      `ShareModal`, which was false at the time it was written — now true
      after this task's `NewsHero` share swap).

      Post-smoke UI-refinement approved state (current, in effect —
      commits `e4a1b6bb`/`d8be9416`/`9decd216`): homepage "Статьи и обзоры"
      — 5 Article cards visible on the desktop rail, sized/spaced to match
      the Events rail's visual weight; card's only explicit action is
      Heart (no Share, no separate Ideas/Plan buttons); Heart anchored
      inside the cover with a consistent ~11-12px inset (not the outer
      card edge); decorative vertical-line/tail artifacts removed (root
      cause was a flex-nesting width bug, not a decorative element); real
      Article category (`CityHomeJournalArticle.category`, already
      selected by `listCityHomeArticles.ts`, reused — no new field/
      taxonomy) renders between cover and title only when present, no
      fabricated category. `/blog`: Heart is the only explicit card/row
      action, no Share; the circular navigation arrow is removed (`ArticleRow`
      in `BlogIndex.tsx`, commit `e4a1b6bb` — confirmed via current git
      state, no arrow markup remains). Article detail/full Article
      (standard, Breaking News, continuous reading): unchanged canonical
      `♡ Сохранить` + `↗ Поделиться`. Product rule stays: cards → Save/
      Heart only; detail/full content → Save + Share.

      Post-deploy targeted visual verification (2026-08-11, actual
      `https://dev.mamago.by`, deployed image `ghcr.io/asoftby/mamago2:dev-272`
      — confirmed via SSH `docker ps` on the DEV host and the Docker Build &
      Push run's `org.opencontainers.image.revision` label, both pinned to
      `9decd2165d0f4d107a8ce7634579d8b59f489601`): **green.** This is a
      scoped visual check of the post-smoke UI refinements only, not a
      repeat of the full Task 6 smoke. Real DEV content for Minsk currently
      has exactly 1 published Article, so the "5 cards" case could not be
      observed with live content — verified instead that the deployed
      card's class list carries the `lg:w-[calc((100%-6rem)/5)]` 5-column
      formula (computed width 208px at 1440px, matching local verification
      exactly) and would render 5 across once more Articles publish.
      Directly observed on the single live card: Heart present, no Share,
      11px inset from the cover's top/right edges (desktop and mobile,
      375px), real category "Обзоры" rendering between cover and title, no
      vertical-line/tail artifacts, no horizontal overflow on mobile.
      Interaction: clicked Heart → Save chooser opened scoped to the
      correct Article, URL stayed on `/minsk` (no navigation); closed the
      chooser; clicked the card body → navigated to the correct Article
      detail page, which still renders `Сохранить`/`Поделиться` unchanged.
      `/blog` quick regression: same single Article's Featured card shows
      Heart, no Share, no arrow — consistent with commit `e4a1b6bb`.
      Console/network: no Article-card-related errors or 500s; the only
      console errors present (repeated `401` on `GET /api/save/status?
      activityId=...` for the guest session, one `400` on a Next.js image
      optimization request for an unrelated Event cover) are pre-existing,
      unrelated to Article cards, and not new — confirmed the new
      `POST /api/save/status/articles` batch endpoint made zero calls for
      this guest session (correct: no unnecessary calls for guests). No
      P0/P1 introduced by this deploy. Task 6 stays `COMPLETE` — this
      verification does not reopen it.

AUDIT FIRST existing Share / My Ideas / My Plan / CTA / saved-state
functionality. Ensure: Share, Save to "My Ideas", Add to "My Plan" wherever
logically applicable. Check: article card, article detail, continuous
reading, authenticated user, guest, analytics, synchronization, mobile,
desktop. Reuse existing universal action components.

**Exit Criteria:** Actions work consistently across all relevant article
surfaces.

## TASK 7 — Day Scenario

Priority: `P0`

STATUS: `COMPLETE_PENDING_BROWSER_SMOKE`
AUDIT:
EXISTING — Live path is `src/features/my-plan/components/{DayScenarioModal,
ScenarioTimeline, ScenarioActionBar, BuildScenarioButton}.tsx`, opened from
`PlanMainContent.tsx`. Trigger `canOpenDayScenario = totalPlannedCount > 2`
(`PlanMainContent.tsx:840-843`) counts only the selected date's `PlanItem`
rows, matches the "3+ same-date activities" spec exactly. Timeline sorting
(`sortPlanItemsForDay.ts`, timed-then-untimed, deterministic), timed/untimed
rendering (no fabricated times, "Без времени" fallback), address/price
formatting, and the desktop-Dialog/mobile-Sheet responsive infra
(`MyPlanOverlay`/`ResponsiveOverlay`) are all real, correct, and reusable.
Guests cannot reach this component tree (`MyPlanPanelContent` renders
`GuestMyPlanPanel` instead when unauthenticated) — no leakage, but also no
guest Scenario today.
PARTIAL/BROKEN — `ScenarioActionBar`'s viewer/"Сохранить в мой план" path
(`onApplyToMyPlan`) is dead: no caller passes it, both `DayScenarioModal`
call sites default to `mode="owner"`. Share is ephemeral text via
`navigator.share`/clipboard only, no URL, nothing persisted. A real
conflict/placement algorithm exists (`src/features/me/lib/dayScheduler.ts`
`findPlacement()`) but is only wired through `useAddScenarioPlan`, whose only
consumer is dead code (see DEAD/LEGACY) — not connected to the live modal.
MISSING — standalone route/page (today modal-only, nested inside the My
Plan overlay itself = dialog/sheet-in-dialog/sheet on both desktop and
mobile); explicit create/draft/ready lifecycle (today always a fresh live
view, nothing to "create"); persistence across reload/logout/date-nav
(nothing written anywhere — confirmed no `Scenario` Prisma model exists,
only unrelated `NotificationScenario` enum); "план изменился" detection
(moot only because nothing is saved yet); pauses; conflict warnings on the
live path; manual reorder/time/duration adjustment (`PlanItem` has no
`duration` column at all); editing UI; analytics (zero `trackUserEvent`
calls anywhere in the Scenario components); tests (zero test files
reference any Scenario component or the trigger logic); guest Scenario
(structurally absent, needs an explicit owner decision if in scope).
DEAD/LEGACY — `src/features/me/lib/dayScenario.ts`'s `buildDayScenario()` is
a stub that always `return null`s; its only consumer
`DayScenarioBlock.tsx` can therefore never render a populated scenario.
`ScenarioFinalPage.tsx` has zero importers anywhere. `PlanCard.tsx` (the
only importer of `DayScenarioBlock`) is wired solely into the internal
`ui-lab` component showcase registry — that registry's own `usedIn`
metadata falsely claims usage in `/me/page.tsx` and `/me/day/[date]/page.tsx`
(neither actually imports it — stale metadata, backlog candidate).
`GuestMyPlanPanel`'s `scenarioSlots`/morning-afternoon-evening picker is an
unrelated feature that only shares the word "scenario" — not a guest
version of Day Scenario, do not merge. `POST /api/plan/generate`'s response
key literally named `scenario` is likewise just a naming collision (it's
the suggestions array), not a persisted Scenario resource.
GAPS: see MISSING above. Core gap vs. target: a real standalone page,
explicit create/persist lifecycle, and wiring the already-existing
`dayScheduler` conflict algorithm into the live path. No Scenario
read/write API exists today, so ownership/authorization is currently moot.
No Google Routes/Distance Matrix/Maps SDK calls exist anywhere in the My
Plan or `me/` scenario code — the owner's cost boundary is already
respected by construction (nothing calls those APIs).
IMPLEMENTATION: Owner approved Option 2, minimal ("we are not building a
full itinerary editor"). Built:
(1) **Data model** — new `DayScenario` model (`id, userId, date, status
[default "READY"], planFingerprint, createdAt, updatedAt`,
`@@unique([userId,date])`), hand-written migration
`prisma/migrations/20260811130000_add_day_scenario/migration.sql` (no
`prisma migrate dev`/`db push`), applied to local dev DB, Prisma client
regenerated. No `DayScenarioItem`/content duplication — the page always
reads current `PlanItem` rows live; the model only marks "a Scenario was
explicitly created for this user/date" + a cheap drift signature. City is
correctly **not** part of the DB identity (confirmed `PlanItem` has no
`cityId` — matches audit finding).
(2) **Service** (`src/server/services/dayScenario.service.ts`) —
`computePlanFingerprint()` (sha256 of sorted `id:startsAt` pairs, order-
independent, drifts on add/remove/time-change), `getDayScenario`,
`ensureDayScenario` (idempotent get-or-create, P2002 race-safety-net
catch), `refreshDayScenario` (recompute + persist, no-op if no row).
(3) **Route/page** — `src/app/(public)/[city]/my-plan/[date]/scenario/
page.tsx`, a real standalone Server Component page (not a modal). Auth via
`redirectToLogin()` (safe `redirectTo` pattern). City validated via
`findCityBySlug` (not used to filter data — display/nav only, matches
audit finding that My Plan identity is user+date). Date validated by
regex, `notFound()` otherwise. An already-created Scenario is always shown
(never hidden if My Plan later drops below 3 items) — only *initial*
creation is threshold-gated via the shared `canOpenDayScenario()` (see
below), so a bookmarked/direct URL open never silently fabricates one
below 3 items but does correctly restore an existing one.
(4) **Conflicts** — re-audited `src/features/me/lib/dayScheduler.ts` before
reuse: its `findPlacement()` solves single-new-item insertion, not
"list every conflicting pair in a fixed set" — not a fit API-wise, so
wrote a small new pure `detectScenarioConflictIds()`
(`src/features/my-plan/lib/detectScenarioConflicts.ts`, adjacent-pair
overlap on a shared 60-min assumed-duration convention, untimed items
never flagged, no fabricated travel time, no optimization). `dayScheduler.ts`
itself left fully untouched, per instruction not to revive the dead chain
around it.
(5) **Reuse, unchanged** — `ScenarioTimeline`/`sortPlanItemsForDay`/address
+price formatting/timed-untimed rendering, all reused as-is; only addition
to `ScenarioTimeline` was an optional `conflictIds` prop for the warning
line.
(6) **Plan-changed** — page compares live `computePlanFingerprint(items)`
vs. the stored one; on mismatch shows "План изменился" + a
`refreshDayScenarioAction` Server Action button ("Обновить сценарий") that
recomputes/persists the fingerprint and revalidates the page. No version
history/stack.
(7) **CTA wiring + a real nested-modal bug found and fixed** — the
existing "Собрать сценарий дня" button now navigates
(`router.push('/{city}/my-plan/{date}/scenario')`) instead of opening
`DayScenarioModal`; that dead modal wrapper + `ScenarioActionBar.tsx` were
deleted (0 other importers, confirmed by grep). Browser verification of
this navigation initially found a **real regression**: the My Plan overlay
Dialog stayed visibly open on top of the new page (exactly the nested-
modal problem Task 7 exists to remove). Root-caused via instrumented
logging (since removed): the pre-existing `onRequestClose()`-then-
`router.push()` pattern (already used by the sticky-counter → `/me/plan`
flow) only "works" today because `/me/plan` is hard-matched by
`isMyPlanFullPageRoute()`, which **fully unmounts** `MyPlanOverlayHost`
instead of waiting on Radix's close animation — our new route wasn't in
that match list, so the close animation got interrupted mid-flight by the
navigation (`getAnimations()` showed `playState:"running"`,
`currentTime:0`, stuck) and never reached its closed visual state. Fix:
added the `/{city}/my-plan/...` route family to `isMyPlanFullPageRoute()`
(`src/components/MyPlanProvider.tsx`), reusing the same reliable mechanism
instead of fighting animation timing. Re-verified clean (0 `[role="dialog"]`
elements after CTA click) on both desktop and mobile viewports.
(8) **Security** — every read/write is scoped server-side by the
session-derived `userId`; the client never supplies a `DayScenario` id at
all (lookups are always by the `(userId, date)` compound key), so
cross-user access isn't just checked, it's structurally unreachable.
Verified with explicit tests (see VERIFICATION).
(9) **Cost** — one bounded `listPlanItemsByDate` query (already existed)
+ one `findUnique`/`create`/`update` on `DayScenario`, no N+1, no polling,
no external API calls (confirmed zero Google Routes/Maps calls in the
Scenario path, matching the audit finding and the owner's cost boundary).
COMMITS: `7e7a2fb3` (audit docs), `a2091390` (schema/migration/service/
route/page/CTA wiring), `c6de4186` (tests + `canOpenDayScenario` extraction
+ always-show-existing-scenario fix), `baf500b3` (nested-modal fix).
VERIFICATION: `npx tsc --noEmit` clean; `npx eslint` on every changed file
clean (0 errors; only pre-existing, unrelated warnings in
`PlanMainContent.tsx`/`MyPlanProvider.tsx`, confirmed identical via
`git stash` diff before/after). `pnpm test:day-scenario` (new bundled
script: `canOpenDayScenario.test.ts`, `detectScenarioConflicts.test.ts`,
`sortPlanItemsForDay.test.ts`, `dayScenario.service.test.ts`) — all green,
covering: 2-items-no-CTA/3-items-CTA threshold, idempotent create (same
row returned, DB unique-constraint duplicate-create rejected), cross-user
read isolation, cross-user "refresh" isolation (wrong user's refresh call
cannot touch another user's row — verified explicitly, not just assumed
safe), fingerprint determinism/order-independence and drift-on-change,
refresh persistence, timed-item chronological sort, untimed-items-sort-
last-without-fabricated-time, conflict detection (overlap/no-overlap/
back-to-back-boundary/mixed-timed-untimed). `pnpm check:push` (`pnpm
build`) exits 0, zero errors, new route `/[city]/my-plan/[date]/scenario`
correctly listed as dynamic (ƒ) in the build output.
DEV SMOKE (local dev server, Browser pane, real seeded user + PlanItems —
not yet deployed-DEV, see BLOCKERS): desktop 1280×720 — My Plan overlay →
selected date with 5 items (2 overlapping, 1 clean, 1 untimed) → CTA click
→ lands on standalone `/minsk/my-plan/2026-09-05/scenario`, correct date/
city header, "5 событий · 12:00–21:00" summary, timeline in correct order
(timed chronological, untimed "Прогулка в парке" last, no fabricated
time), both real conflicting items show "⚠ Время пересекается", the
non-overlapping 17:00 item does not. Direct reload of the URL: identical
render, Scenario restored (not recreated — `id`/`createdAt` unchanged,
confirmed via DB read). Leave (navigate to `/minsk/events`) and reopen via
URL: state correctly restored. Modified My Plan (added a 6th item directly
via DB, simulating a real add) → reopened page → "План изменился" banner
shown with the new item already visible in the live timeline (My Plan
stays source of truth) → clicked "Обновить сценарий" → banner disappeared,
`planFingerprint`/`updatedAt` correctly updated in DB, same row id (no
duplicate). "Insufficient activities" state verified for a date with 0
items (no Scenario row created, correct empty-state copy + link back to
`/me/plan`). Mobile 375×812: normal full page (not a Sheet), same content,
readable timeline, no layout break, 0 `[role="dialog"]` elements. No
relevant console errors on either viewport (only expected dev-only HMR
websocket noise from the preview-tool's server restarts, not app errors).
No network requests failed (except the same dev-only HMR channel).
BLOCKERS: none for local completion. Real actual-`dev.mamago.by` smoke is
owner-controlled deployment, not yet performed (per instruction: push only
when clean, then stop for owner-controlled deployment — no DEV/PROD deploy
attempted by this session).
BACKLOG/NOTES: BACKLOG-055 (guest Scenario persistence, explicitly
deferred), BACKLOG-056 (manual reorder/time/duration editing, explicitly
excluded from MVP), BACKLOG-057 (pauses/free intervals, explicitly
excluded), BACKLOG-058 (public read-only share URL, explicitly excluded),
BACKLOG-059 (recommendation insertion into timeline gaps, explicitly
excluded), BACKLOG-060 (travel-time/Google Routes integration, explicitly
excluded per cost boundary), BACKLOG-061 (dead `src/features/me/` Day
Scenario chain — finish-or-delete decision, left fully untouched by this
task as instructed). All recorded in `docs/engineering/backlog.md`, none
implemented.

UX / FUNCTIONAL COMPLETION PHASE (2026-08-11, Claude Code — supersedes
nothing above; the accepted foundation through commit `6d2d829b` — schema,
persistence, one-Scenario-per-user/date, fingerprint, "План изменился",
refresh, conflict detection, ownership isolation, no Google Routes — was
preserved unchanged. This phase makes the Scenario genuinely useful and
converges every My Plan entry point on it):
AUDIT (narrow, before touching code) — confirmed via direct code read:
`PlanItem.startsAt` is populated at add-time from a client-resolved
`ActivitySession` (`/api/save/plan/route.ts:124-145`) — genuinely
authoritative when set, but null whenever the add-flow (e.g. quick-add
suggestions) didn't resolve a session, even though the `Activity` itself
may have exactly one real scheduled `ActivitySession`. This is the real
"Без времени" data bug the owner flagged, not a display bug — confirmed by
reading the schema (`ActivitySession{id,activityId,startsAt}`, no `endsAt`)
and the add-flow. No reliable duration field exists anywhere in the schema
(`ActivitySession` has no `endsAt`, `Activity` has no duration column) —
confirmed via full-schema grep; free-gap/end-of-day display were built to
use one but architected to never fabricate when absent (i.e., they will
not visibly activate until a real duration source exists — this is
correct, not a bug). `formatActivityAddressLine()` never touched price
fields — the "long price string where address should be" issue traced to
the old `ScenarioTimeline`'s separate `formatPrice()` meta line (now
removed from Scenario cards entirely, not just hidden).
IMPLEMENTATION:
(1) Data correctness — `listPlanItemsByDateForScenario()`
(`dayScenario.service.ts`) extends the per-date query with `scheduleMode` +
same-date `ActivitySession`s (generous DB window, exact match via
`getLocalDateKey`, never a cross-day guess); `resolveScenarioItemTime()`
(`scenarioProjection.ts`) recovers an authoritative time only when exactly
one session matches the exact planned date — genuinely ambiguous cases
(0 or 2+ same-date sessions) correctly fall through to flexible/override,
never guessed.
(2) Flexible-time assignment — new `DayScenarioItemOverride` model
(`id, scenarioId, planItemId, startTimeOverride`, `@@unique([scenarioId,
planItemId])`, cascade-deletes with either parent), hand-written migration
`prisma/migrations/20260811150000_add_day_scenario_item_override/
migration.sql`. No `DayScenarioItem`, no content duplication — only an
FK + a time. Service functions `setScenarioItemOverride`/
`listScenarioItemOverrides`/`pruneScenarioItemOverrides`; ownership is
structural (Scenario looked up by `(userId,date)`, PlanItem must match the
same `userId`+`date` — never a client-supplied id trusted). New
`setScenarioItemTimeAction` Server Action + `AssignScenarioTimeControl.tsx`
(native `<input type="time">`, inline expand/collapse, no nested dialog).
Fixed/recovered source time always wins over an override by construction
(`resolveScenarioItemTime` checks source before override).
(3) Converged CTA everywhere — extracted `resolveScenarioCtaState`/
`resolveScenarioCtaLabel` (`canOpenDayScenario.ts`) as the one shared rule
for "Собрать сценарий дня" / "Открыть сценарий дня" / "Сценарий дня · План
изменился". Wired into **both** required entry points: the full `/me/plan`
page (`PlanDayList.tsx`'s new `ScenarioCta`, server-computed
`scenarioStatusByDate` in `me/plan/page.tsx` via one bounded
`dayScenario.findMany` + reused-fingerprint comparison — no extra
per-render cost) and the My Plan overlay panel (`PlanMainContent.tsx`),
which previously always showed "Собрать сценарий дня" even when a Scenario
already existed — a real inconsistency found and fixed during this phase.
The overlay's status is threaded through the **existing** per-date
`/api/save/plan/day` fetch (`scenarioStatus` field added to that response,
consumed by `useMyPlan.tsx`) — reuses an already-happening request, adds no
new round trip, no polling. `/me/plan?date=` now seeds the initially
selected date (small, backward-compatible addition — falls back to today),
making "Изменить план" from the Scenario page land on the correct date.
(4) Timeline redesign — time is now the primary visual anchor (large,
outside the card, next to the marker/line), not buried in card metadata.
Flexible items show "Гибкое время" (not "Без времени") + "+ Назначить
время". Cards dropped price entirely (title → address → duration → small
cover only, per the owner's card-priority spec) — `listPlanItemsByDateForScenario`'s
select doesn't even fetch price fields anymore, so the bug class is closed
by construction, not just hidden in the UI. Conflict warning kept
adjacent to the affected item; overlap-amount-in-minutes deliberately
**not** shown (would require the same non-real assumed-60-min heuristic
used only for detection — showing it as a precise number would itself be
fabricated data, so it's omitted rather than faked). Free-gap blocks and
"День завершится около HH:MM" are fully implemented
(`deriveFreeGapMinutes`/`deriveEndOfDay`) but — correctly, per "never
fabricate" — will not render until a real duration source exists.
(5) "Изменить план" — added to the Scenario page header, links to
`/me/plan` (now date-aware via the `?date=` support above). Scenario still
owns no item-selection UI.
MIGRATION: hand-written, `DayScenarioItemOverride` only (see above); no
`prisma migrate dev`/`db push`; applied to local dev DB; Prisma client
regenerated.
COMMITS: implementation landed in this session's working tree; see final
pushed SHA below (single consolidated push per owner instruction — targeted
checks were run throughout, not after every micro-change).
TESTS: `pnpm test:day-scenario` (bundled script) extended with
`scenarioProjection.test.ts` (time resolution priority incl. fixed-wins-
over-override and ambiguous-sessions-never-guessed, duration always null,
sort with mixed fixed/override/flexible, free-gap arithmetic incl. overlap
→ null not negative, end-of-day incl. unknown-duration → null),
`formatActivityAddress.test.ts` (address resolution correctness, confirms
no fabricated fallback), extended `canOpenDayScenario.test.ts` (CTA state/
label matrix incl. "existing Scenario stays reachable below threshold"),
extended `dayScenario.service.test.ts` (override idempotent upsert,
cross-user override rejection, foreign/wrong-date PlanItem rejection,
prune-on-refresh, same-date session recovery incl. the 2-sessions-never-
guessed case) — all green. `npx tsc --noEmit` clean throughout. `npx
eslint` clean on every changed file (0 new warnings — verified via
`git stash` diff against pre-change baseline for the two largest/pre-
existing-warning files). `pnpm check:push` (`pnpm build`) exits 0.
DEV SMOKE (local dev server, Browser pane, fresh QA fixtures — one real
`ActivitySession`-backed Activity with `PlanItem.startsAt` deliberately
null, one fixed item, one genuinely flexible item, two overlapping fixed
items, cleaned up after): recovered time renders correctly (session at
08:00 UTC → correctly shown as 11:00 local); flexible item shows "Гибкое
время" + "Назначить время"; assigning 15:45 re-sorted the timeline
immediately into chronological position, changed the meta line from
"N событий · 1 требует времени" to a full "HH:MM–HH:MM" span (all items
now effectively timed), and **persisted across a full page reload**;
conflict warnings correct on both overlapping items and unaffected
elsewhere. Full "план изменился" round-trip re-verified with the new
override machinery in place: added a 6th item via DB → banner appeared on
both the Scenario page and the My Plan full-page CTA ("Сценарий дня · План
изменился") → clicked "Обновить сценарий" → banner cleared, override for
the still-present flexible item **preserved**; removed the overridden item
from My Plan → its `DayScenarioItemOverride` row was confirmed gone via
direct DB read (FK cascade, not application code) → Scenario page correctly
showed "План изменился" again with the item absent from the timeline.
Empty-state (0 items) and the overlay CTA → standalone-page navigation
(desktop, confirmed 0 `[role="dialog"]` elements after navigating, mobile
375×812) were re-verified clean — no regression from the earlier session's
nested-modal fix. Mobile 375×812: timeline/time/markers/cards/conflict
warnings all readable, no overflow, "Обновить сценарий" flow works
identically. No relevant console/network errors on any of the above (only
expected dev-only HMR websocket noise from local preview-tool restarts).
BLOCKERS: none for local completion. Real `dev.mamago.by` smoke remains
owner-controlled, not performed by this session.
BACKLOG/NOTES: BACKLOG-056 updated in place (not duplicated) — flexible-
item time assignment is DONE; arbitrary drag-and-drop reorder and manual
duration editing remain OPEN/deferred, narrowed scope recorded. All other
Task 7 backlog entries (BACKLOG-055, 057–061) unchanged, still correctly
deferred, none implemented in this phase.

REAL-DEV SMOKE (2026-08-11, Claude Code — PARTIAL, see BLOCKER below;
STATUS stays `COMPLETE_PENDING_BROWSER_SMOKE`, deliberately not flipped to
`COMPLETE`):
DEPLOYED VERSION — confirmed exact match. `dev-app-1` running image
`ghcr.io/asoftby/mamago2:dev-274`; `docker inspect` label
`org.opencontainers.image.revision` = `c10398f2eb5ca009998f10806ef7ebb48df81ef9`
— byte-exact match to the pushed SHA, `org.opencontainers.image.created`
`2026-08-11T11:13:20.183Z`. `dev-db-1`/`dev-prisma-studio-1` also healthy.
VERIFIED ON REAL DEV (real content, real disposable QA account
`task7-realdev-smoke@example.invalid`, registered/used/fully deleted via
the real self-service "Удалить аккаунт" flow afterward — no residue):
— My Plan CTA, 2-item state: added 2 real distinct entities (article
"«Гранд Бублик»…" + Place "Большой театр Беларуси") to 11 августа 2026 —
`/me/plan?date=2026-08-11` correctly shows "2 события" with **no** Scenario
CTA (confirmed via DOM text, the CTA string never renders — matches
`resolveScenarioCtaState`'s `hidden` case).
— Scenario page empty states: direct load of
`/minsk/my-plan/2026-08-11/scenario` (2 real items) and
`/minsk/my-plan/2026-09-12/scenario` (1 real fixed-time item, a real
Event "С. Кибирова балет «Три поросенка»", session 12 сент. 2026 16:00 at
Большой театр Беларуси) both correctly show "Пока недостаточно событий" —
never silently creates a Scenario below the threshold, matches local
behavior exactly.
— Real fixed time preserved end-to-end: the real Event's session
(16:00, 12 сентября) round-tripped correctly through save → `PlanItem.startsAt`
→ `/me/plan` raw list display — no invented time, no drift.
— Standalone route confirmed: both Scenario URLs load as plain pages;
`document.querySelectorAll('[role="dialog"]').length === 0` on both,
mobile 375×812 and desktop — no nested modal/sheet regression on real
infra, matches the earlier local fix.
— Security/cost: zero `googleapis`-pattern network requests on Scenario
page load (cost boundary intact in production); zero Scenario-related 500s;
on a **fresh tab** (isolating from unrelated accumulated console noise from
registration/browsing), zero console errors on both Scenario URLs;
ownership remains structurally uninjectable — the route/API carry no
Scenario or override id at all, so there is nothing for a client to tamper
with regardless of account.
— Cleanup confirmed: all 3 QA `PlanItem` rows removed via the real "✕"
remove action before account deletion; `/me/plan` confirmed back to
"0 событий · на 0 дней"; no `DayScenario` row was ever created for either
date (never reached the 3-item threshold) — real DEV left exactly as
found.
NOT INDEPENDENTLY OBSERVABLE ON REAL DEV THIS SESSION (see BLOCKER) —
flexible-item time assignment ("Назначить время"/"Изменить время"
persistence and reorder), the populated Scenario timeline itself (time as
primary anchor, address/duration card layout, "Гибкое время"), deterministic
conflict warnings, and the full "План изменился" → "Обновить сценарий" →
override-preservation round trip. Free-gap/end-of-day: correctly
`not observable with current DEV dataset` per the task's own instruction
(no reliable duration source exists in the schema at all, confirmed during
implementation) — this one is expected to stay unobservable regardless of
dataset size, not a smoke gap.
BLOCKER (environment/access, not a Task 7 code issue) — real DEV's public
catalog currently has exactly 3 distinct saveable entities reachable via
the UI (1 Event, 1 Article, 1 Place; `/minsk/programs`, `/minsk/routes`,
`/moscow`, `/marina-gorka` all confirmed empty; `/api/search` returns no
results) — not enough to reach the 3-item Scenario-creation threshold with
real, distinct content on one date. The established fallback for exactly
this situation (isolated DB-level QA fixtures via SSH — the same method
used successfully for the local-dev verification earlier this session and
for prior DEV media-import sessions, see `BACKLOG-018`) was attempted but
SSH to the DEV host (`134.17.17.134:22`) was unavailable for the duration
of this session — intermittently reachable at raw TCP (`nc` succeeded
twice) but the SSH protocol handshake itself timed out on every attempt
(6 attempts across ~10 minutes). HTTPS to the same host worked throughout
(this real-DEV smoke itself proves the host is healthy) — this reads as a
network-path/firewall issue specific to port 22 from this session's egress,
not a DEV host outage. Creating new real public content (a real Event/Place)
via the actual editor flow to work around this was considered and rejected
as out of scope for a "read-only / safe verification" pass — that would
mean publishing new content visible to real users, not a disposable fixture.
NO NEW P0/P1 found. One pre-existing, unrelated issue noticed incidentally
(not a Task 7 regression — the affected code was not touched by any Task 7
commit): `PlanDayList.tsx`'s `unavailable` badge
(`getPlanActivityPublicAvailability`) returns `"missing_activity"` — shown
as "СНЯТО" — for **every** Place/Article-type `PlanItem` on the `/me/plan`
list, because that function only ever receives `item.activity` (`null` for
non-Activity types) and treats `null` as "removed". Observed on both real
QA items (a live, published Article and a live, published Place). Filed as
a new backlog candidate below; not investigated further per this task's
own "do not investigate unrelated known issues" instruction.
RECOMMENDATION: keep `COMPLETE_PENDING_BROWSER_SMOKE`. The UX-phase code
itself was already exhaustively verified against byte-identical logic on
local dev earlier this session (full test suite + extensive browser
verification of exactly the checks listed as "not independently
observable" above — flexible assignment, conflicts, plan-changed/override
preservation, populated timeline, mobile). What's missing is proof against
*real* DEV infrastructure specifically, blocked by an access/content
constraint outside this session's control, not a code defect. Suggest a
short follow-up pass once SSH access is confirmed restored (or once real
DEV content grows past 3 distinct entities) to close the remaining items
and flip to `COMPLETE`.

FINAL INTERACTIVE REAL-DEV SMOKE (2026-08-11, Claude Code — SSH access
restored this round; STATUS stays `COMPLETE_PENDING_BROWSER_SMOKE`, still
not flipped to `COMPLETE` — a real regression was found, see below).
Confirmed `dev-app-1` still running `dev-274` / `c10398f2` (unchanged, no
redeploy — `docker inspect` re-checked). Created isolated QA fixtures via
direct DB access (one disposable real account,
`task7-final-smoke@example.invalid`, registered through the real DEV UI;
4 disposable `PlanItem` rows inserted directly via SQL for that user/date
only) to exercise the populated 3+ Scenario flow the previous partial
smoke couldn't reach. All 12 requested checks executed:
1. 3 PlanItems -> `/me/plan?date=...` correctly shows "Собрать сценарий
   дня" — GREEN.
2. Clicking it creates and navigates to a populated standalone Scenario
   ("3 события · 1 требует времени") — GREEN.
3. Fixed-time item ("QA Fixed A") shows its stored time prominently — GREEN.
4. Untimed item shows "Гибкое время" + "Назначить время" — GREEN.
5. "Назначить время" -> picked 12:30 -> "Сохранить" — **RED, real bug
   found** (detail below).
6. Reload: the (incorrect) assigned value persisted correctly — the
   persistence mechanism itself is GREEN; only the stored value's
   timezone interpretation was wrong (see below).
7. The assigned time correctly participated in chronological ordering
   relative to its own (incorrect) stored value — GREEN as a sorting
   mechanism; see below for why the displayed number was wrong.
8. Added a 4th real PlanItem via SQL 15 minutes after a fixed item ->
   both correctly flagged "⚠ Время пересекается" — GREEN.
9. Same DB-added 4th item correctly triggered "План изменился" on
   reopen — GREEN.
10. "Обновить сценарий" cleared the banner; the flexible item's override
    was correctly preserved (same value, not reset) — GREEN.
11. Confirmed via direct DB read: exactly one `DayScenario` row for the
    user/date throughout (`createdAt` != `updatedAt`, bumped once by the
    refresh, never a second row) — GREEN.
12. 375px mobile: timeline/markers/cards/conflict badges/override control
    all readable, no overflow, matches desktop content — GREEN.
Free-gap/end-of-day: still `not observable with current DEV dataset` (no
reliable duration source exists in the schema at all — expected, not a
gap in this smoke).
REAL BUG FOUND AND FIXED (check 5) — assigning "12:30" via "Назначить
время" displayed back as "15:30" (a reproducible +3h drift) after save.
Root-caused precisely: `setScenarioItemTimeAction` built the override's
`Date` via a bare `new Date(\`${date}T${time}:00\`)`, which — per the
ECMAScript spec — parses a date-time string with no timezone suffix using
the *executing process's own local timezone*. The DEV container runs with
no `TZ` set (`Intl.DateTimeFormat().resolvedOptions().timeZone` = `"UTC"`,
confirmed via `docker exec`), so the input was silently stored as if it
were UTC, while every displayed time on the page (both this override and
the real `PlanItem.startsAt` values) renders via the *client's browser*
timezone — a different, unrelated value from the container's OS setting.
This exact asymmetry never surfaced during local-dev testing because the
local dev process's OS timezone happened to coincide closely enough with
the testing browser's rendering to mask it. Fixed in
`src/lib/date/localDateKey.ts` (`localWallClockToUtc()`, exported and
consumed by `setScenarioItemTimeAction`): explicitly interprets the
"HH:MM" input as `DEFAULT_TZ` (Europe/Minsk, matching the same convention
every real Activity session time already uses) via a library-free
guess-and-correct `Intl.DateTimeFormat`/`Date.UTC` technique — never an
ambient `new Date(string)` re-parse. Caught a subtle self-inflicted repeat
of the same bug class while implementing this: a first version of the fix
used `new Date(instant.toLocaleString(...))` to read back the zoned wall
clock, which *itself* re-introduced an ambient-timezone dependency (only
"worked" by coincidence because the local dev machine's own OS timezone
happens to equal Europe/Minsk) — caught by explicitly re-running the new
unit tests under `TZ=UTC` and `TZ=America/New_York`, both of which exposed
the flaw immediately. The shipped fix passes under both of those plus the
default environment. New tests: `src/lib/date/localDateKey.test.ts`
(`localWallClockToUtc`: exact UTC instant for a known Europe/Minsk
wall-clock time, a midnight-crossing case, and a `getLocalDateKey`
round-trip), now included in `pnpm test:day-scenario`.
NOT YET RE-VERIFIED LIVE — this fix is committed to `dev` but the running
`dev-274` container does not include it (no redeploy performed this
session, per this task's explicit instruction). Checks 5-7 above are
therefore GREEN for "the save/persist/reorder/conflict-participation
*mechanism*" but the exact displayed time value was proven wrong on the
currently-deployed build. All QA fixtures (4 `PlanItem` rows, the
`DayScenario` row, the `DayScenarioItemOverride` row, both this round's
and the previous round's disposable accounts) confirmed fully removed via
direct DB read (`select count(*) from "User" where email like
'task7-%'` = `0`) — real DEV left exactly as found, no residue.
RECOMMENDATION: still keep `COMPLETE_PENDING_BROWSER_SMOKE`. 11 of 12
requested checks are fully green against the currently-deployed build;
the one that failed has a proven, tested, committed fix, but per this
round's own instructions no redeploy was performed to verify it live.
Suggest the owner deploy the next build (which will include this fix)
and a short, narrow follow-up smoke — just re-run check 5 (assign a time,
confirm it displays back unchanged) — to finally close Task 7.

Trigger: 3+ activities in "My Plan" on one date. AUDIT FIRST existing Day
Scenario / My Plan / timeline implementation: existing modal flow,
modal-in-modal, models, APIs, persistence, timeline, time, duration,
addresses, ordering, conflicts, trigger logic, mobile UX. Goal: a clear,
standalone Scenario of the Day. Consider existing capabilities for: dedicated
screen/page, access from My Plan, timeline, intervals, editing, restored
state. Architecture should allow adding recommendations between points
later. Do not build a permanent, expensive dependency on the Google Routes
API now without proven product need.

**Exit Criteria:** A user with 3+ activities sees and understands the whole
family day from one screen.

## TASK 8 — Schema.org / Structured Data

Priority: `P0 — SEO BLOCKER`

STATUS: `TODO`
AUDIT: —
GAPS: —
IMPLEMENTATION: —
COMMITS: —
VERIFICATION: —
DEV SMOKE: —
BLOCKERS: —
BACKLOG/NOTES: —

AUDIT FIRST existing SEO utilities and JSON-LD. Build an audit matrix: `page
type → current schema → problem → missing → required action`. Check:
Events, Places, Articles, Routes, Offers, Services, Programs (if indexed),
listing/category pages, BreadcrumbList, Organization, WebSite, other actually
used Schema.org types. Also: H1/H2/H3, canonical, city URLs, title,
description, OpenGraph, robots, indexability, JSON-LD validity, duplicate
entities, conflicting entities, Rich Results compatibility where applicable.
Reuse shared SEO utilities.

**Exit Criteria:** No main indexable page type reaches PROD without correct
SEO/structured-data implementation.

## TASK 9 — Filters & Quick Access

Priority: `P0`

STATUS: `TODO`
AUDIT: —
GAPS: —
IMPLEMENTATION: —
COMMITS: —
VERIFICATION: —
DEV SMOKE: —
BLOCKERS: —
BACKLOG/NOTES: —

AUDIT FIRST existing filtering infrastructure: date/when, age, district,
metro, free, budget, additional filters, quick access, active state, reset,
URL state, back navigation, empty results, mobile, desktop, analytics. Check
for multiple incompatible filter implementations. Do not create another
system without necessity.

**Exit Criteria:** Filters are understandable, fast, consistent, and cheap
at runtime.

## TASK 10 — `nokids`

Priority: `P0`

STATUS: `TODO`
AUDIT: —
GAPS: —
IMPLEMENTATION: —
COMMITS: —
VERIFICATION: —
DEV SMOKE: —
BLOCKERS: —
BACKLOG/NOTES: —

AUDIT FIRST existing age restrictions / 18+ / audience models / tags /
filters. Do not automatically create a new DB field — first determine
whether the existing data model can reliably express strict 18+/no-kids.
Check: Event Wizard, Admin, cards, Event detail, Search, filters, ranking
compatibility.

**Exit Criteria:** 18+ content is systematically and unambiguously separated
from family/kids content without unnecessary model duplication.

## TASK 11 — Article Gallery Visual Types

Priority: `P0`

STATUS: `TODO`
AUDIT: —
GAPS: —
IMPLEMENTATION: —
COMMITS: —
VERIFICATION: —
DEV SMOKE: —
BLOCKERS: —
BACKLOG/NOTES: —

AUDIT FIRST Article block/editor/gallery infrastructure: image blocks,
gallery blocks, editor, frontend rendering, imported galleries, continuous
reading, responsive, existing libraries/components. Target visual types: (1)
Carousel, (2) Mosaic, (3) Full-width sequential images. Check: editor
selection, preview, rendering, responsive, mobile gestures, aspect ratio,
layout shift, image optimization, alt text, captions, imported articles, new
articles, continuous reading. Extend the existing gallery block where
possible.

**Exit Criteria:** The editor can pick one of the three visual types and the
frontend renders it reliably on mobile and desktop.

## TASK 12 — CEO Performance Dashboard

Priority: `P0 — PRE-LAUNCH VISIBILITY`

STATUS: `TODO`
AUDIT: —
GAPS: —
IMPLEMENTATION: —
COMMITS: —
VERIFICATION: —
DEV SMOKE: —
BLOCKERS: —
BACKLOG/NOTES: —

### Goal

Before PROD, the owner must have one simple factual page answering:

**“Как проект работает прямо сейчас?”**

Canonical route: `/admin/performance`

### AUDIT FIRST

Audit the existing:

- `/admin/analytics`;
- Publication Analytics;
- `UserEvent`;
- authentication/user models;
- existing business metrics;
- existing search analytics;
- existing content-performance aggregation;
- existing dashboard services/components;
- any already-existing DAU/WAU/MAU logic;
- any existing registrations/activity/retention queries.

Reuse the current analytics infrastructure.

Do **not** create another analytics platform.

Do **not** build a data warehouse.

Do **not** duplicate metrics already calculated elsewhere.

### MVP scope

The page should expose **FACT metrics**, not forecasts or decorative fake
KPIs.

At minimum audit feasibility and provide the useful available subset of:

#### Audience / usage

- DAU;
- WAU;
- MAU;
- WAU / MAU;
- new users;
- returning users;
- registrations.

#### Engagement

Use existing trusted signals where available, e.g.:

- My Ideas additions;
- My Plan additions;
- meaningful content opens;
- relevant CTA activity.

Do not invent events that are not actually tracked.

#### Content / marketplace health

Use existing real data where useful, e.g.:

- published Events;
- published Places;
- published Offers;
- active businesses;
- content with engagement.

#### Business / monetization metrics

Only include monetary metrics here if the underlying system can calculate
them truthfully.

Do not fabricate revenue, GMV, ARPU, lead revenue, or balance values.

Task 13 owns the deeper balance/monetization architecture decision.

### Time ranges

The dashboard should make daily / weekly / monthly state understandable.

Reuse existing date-range infrastructure where possible.

Do not build arbitrary BI filtering.

### UX

This is an owner/CEO operational page.

It should be:

- simple;
- fast;
- factual;
- understandable in seconds;
- mobile-safe but primarily desktop/admin oriented.

No decorative analytics for their own sake.

### Security / cost

- ADMIN only unless existing admin policy clearly dictates otherwise;
- bounded aggregate queries;
- no user-level PII output;
- no raw event dumps;
- no expensive unbounded analytics scans;
- no polling unless already justified.

### Exit Criteria

**The owner can open `/admin/performance` and quickly understand the factual
daily/weekly/monthly health of mamaGo using real existing data, without a
parallel analytics architecture or fabricated metrics.**

## TASK 13 — Audit Business Balance & Monetization

Priority: `P0 — MONEY / PROD BLOCKER`

STATUS: `TODO`
AUDIT: —
GAPS: —
IMPLEMENTATION: —
COMMITS: —
VERIFICATION: —
DEV SMOKE: —
BLOCKERS: —
BACKLOG/NOTES: —

### Why this is mandatory

This task concerns **real money**.

The owner explicitly decided that the existing balance/monetization mechanics
must be understood and made safe **before first PROD**.

Do not defer the core audit until after release.

### AUDIT FIRST — mandatory

Before proposing or implementing anything, audit the actual current
architecture for:

- Business balance;
- top-ups;
- payment provider/payment records;
- credits;
- debits/write-offs;
- leads;
- paid lead mechanics;
- Boost;
- promotion;
- ledger/history;
- refunds;
- failed payments;
- reversals;
- admin adjustments;
- manual balance changes;
- idempotency;
- ownership/isolation;
- concurrency;
- money precision/currency representation;
- audit logging;
- relevant Business UI;
- relevant Admin UI;
- existing Prisma models;
- existing APIs/services;
- existing tests.

Classify:

- EXISTING;
- PARTIAL / BROKEN;
- MISSING;
- DO NOT TOUCH;
- minimum required pre-PROD scope.

### Product comparison

Review the previously-approved reference concept:

**Kufar-style wallet/internal-balance mechanics**

Use it as a product comparison, not as an instruction to copy Kufar
architecture literally.

Answer:

- what money the user actually pays;
- what the internal balance represents;
- whether balance is real money / prepaid credit / internal units;
- when balance is credited;
- when it is written off;
- whether unused balance expires;
- what happens when a business topped up but bought nothing;
- what happens on failed/cancelled paid actions;
- what happens on refund;
- whether Boost spends from balance;
- whether leads spend from balance;
- what admin can adjust manually;
- what history/audit trail the business sees.

### Decision principle

After the audit, make **one simple MVP monetization decision**.

Do not build:

- complex billing;
- subscriptions;
- multi-wallet accounting;
- bonus currencies;
- promotional currencies;
- accounting software;
- an unnecessarily complex financial ledger

unless the current architecture genuinely requires it for safe first PROD.

Prefer the smallest understandable mechanics.

### Safety requirements

Before PROD, monetary writes must have clear protection against:

- double charge;
- duplicate webhook;
- duplicate Boost write-off;
- race conditions;
- negative balance when not allowed;
- unauthorized balance mutation;
- foreign-business access;
- silent admin adjustment;
- amount precision errors;
- partial transaction state.

Use DB transactions/constraints/idempotency where the existing architecture
requires them.

### Admin

Audit whether admin can safely:

- see balance/history;
- understand why money changed;
- make an adjustment if the product requires it;
- see who made that adjustment.

Do not add broad financial-admin capabilities without need.

### Business

The business must be able to understand at minimum:

- current balance;
- what credited it;
- what spent it;
- what paid action caused the debit.

Do not expose internal implementation noise.

### Exit Criteria

**Before first PROD, mamaGo has one documented and technically-safe MVP rule
for business balance/top-up/write-off/refund/Boost/paid actions, and the
existing implementation has been audited and minimally corrected so real
money cannot be charged or mutated ambiguously or unsafely.**

---

# PART II — INFRASTRUCTURE READINESS

## TASK 14 — Environment Parity / PROD Configuration

Priority: `P0 — PROD BLOCKER`

STATUS: `TODO`
AUDIT: —
GAPS: —
IMPLEMENTATION: —
COMMITS: —
VERIFICATION: —
DEV SMOKE: —
BLOCKERS: —
BACKLOG/NOTES: —

Goal: never let DEV work while PROD breaks due to environment differences.
AUDIT FIRST environment-specific dependencies. Build a matrix:
`dependency/config → LOCAL → DEV → PROD requirement → verified?`. Check:
required/optional env variables, DB URLs, DB permissions, storage, media
URLs, authentication secrets, cookies, cookie domains, OAuth callbacks,
Telegram/webhooks, Google APIs, API restrictions, allowed domains, canonical
host, public site URL, public/admin/business host logic, CORS,
cron/background jobs, email, notifications, analytics, feature flags,
CDN/proxy, production-only integrations, production secrets. **Never output
secret values in documentation or final reports** — only check
existence/configuration shape.

**Exit Criteria:** No unknown mandatory PROD configuration is discovered
only during deployment.

## TASK 15 — Deployment & Rollback Readiness

Priority: `P0 — PROD BLOCKER`

STATUS: `TODO`
AUDIT: —
GAPS: —
IMPLEMENTATION: —
COMMITS: —
VERIFICATION: —
DEV SMOKE: —
BLOCKERS: —
BACKLOG/NOTES: —

This is NOT a deployment. Goal: know the safe path forward and back ahead of
time. AUDIT FIRST the actual deployment architecture/process. Determine:
deploy source branch, exact deploy commit/SHA, who runs deployment, how
deployment is triggered, application deployment sequence, DB migration
sequence, media/storage dependencies, pre-deploy checks, backup
requirements, rollback mechanism, rollback limitations, irreversible
migrations, immediate post-deploy smoke. Check: no dependency on local
untracked files, no dependency on accidental local state, deployed SHA is
determinable, previous app version can be restored, whether a DB backup is
needed. **Do not perform deployment. Do not perform destructive PROD
operations.**

**Exit Criteria:** Before deployment it is clear: (1) what to deploy, (2) how
to deploy, (3) in what order, (4) how to verify, (5) what to do on failure,
(6) how to return to a safe state.

---

# PART III — FINAL RELEASE SAFETY AUDIT

## TASK 16 — Final Release Safety Audit

Priority: `P0 — FINAL RELEASE BLOCKER`

STATUS: `TODO`
AUDIT: —
GAPS: —
IMPLEMENTATION: —
COMMITS: —
VERIFICATION: —
DEV SMOKE: —
BLOCKERS: —
BACKLOG/NOTES: —

Start only after Tasks 1–15 are complete. Goal is NOT to find everything
that could be improved in the repository — it is to determine whether
anything makes the first PROD
deployment unsafe. P2/P3 → backlog. Only fix P0/P1 here.

**A. Security** — risk-focused: authentication, authorization, RBAC, USER
isolation, BUSINESS_OWNER isolation, MODERATOR, ADMIN, API permissions,
ownership checks, validation, sensitive inputs, rate limits on sensitive
endpoints, media/uploads, secret exposure, debug endpoints, accidental
credentials, sensitive logs, critical dependency vulnerabilities. Do not turn
this into a theoretical security rewrite.

**B. Data Integrity** — Prisma sanity, migrations, pending migrations,
destructive operations, constraints, uniqueness, migration order,
production-data compatibility, import idempotency, accidental
delete/update paths, critical transactions, obvious corruption risks.

**C. Core Business Logic** — risk-focused end-to-end sanity: authentication,
public discovery, Events, Places, Search, Filters, Articles, My Ideas, My
Plan, Day Scenario, critical Business flows, critical Admin flows. Do not
manually test every button in the app.

**D. Server Cost & Performance** — only real dangerous paths: N+1, unbounded
DB queries, obvious missing limits, repeated expensive queries, polling,
expensive per-page work, external API overuse, Google API usage, excessive
analytics writes, huge payloads, massive in-memory datasets, obvious hot-path
problems. No global premature optimization — P2/P3 performance improvements
→ backlog.

**E. Failure Handling** — on critical flows, check: external API
unavailable, image unavailable, empty results, DB/API error, invalid input,
unauthorized access, timeout, missing unexpected data. Users must get a safe
state. Never expose secrets, internal stack traces, or sensitive server
data.

**F. SEO / Public Web Safety** — final cross-check: robots, sitemap,
canonical, city routing, redirects, index/noindex, metadata, structured
data, critical public 404, critical 500. Do not redo SEO development if
Task 8 is already closed.

**G. Deployment Safety** — cross-check: release SHA known, repository state
understood, migrations understood, environment ready, backup requirement
understood, rollback understood, no DEV-only configuration, no obvious
release blocker.

**Result:** compile P0 (critical blockers), P1 (high blockers), P2 (moved to
backlog), P3 (moved to backlog / ignored if insignificant). If no P0/P1:
`AUDIT COMPLETE` — do not keep artificially searching for new problems. If
P0/P1 found: minimally fix, targeted verify, atomic commit, re-verify only
the affected area. Do not restart a full repository audit from scratch after
each fix.

---

# PART IV — FINAL GATE

## TASK 17 — Final DEV → PROD Gate

Priority: `P0`

STATUS: `TODO`
AUDIT: —
GAPS: —
IMPLEMENTATION: —
COMMITS: —
VERIFICATION: —
DEV SMOKE: —
BLOCKERS: —
BACKLOG/NOTES: —

Start only after Tasks 1–16 are complete and no unresolved P0/P1 remain.
This is the single full final release gate.

**Git / Repository:** expected branch; expected HEAD; exact release SHA
known; working tree clean; no foreign changes; no unexpected untracked
release files; `git diff --check`.

**Database / Prisma:** Prisma validate; migration state understood; pending
migrations understood; no unknown destructive migration; production
migration sequence understood.

**Application:** relevant automated tests; integration tests; lint;
typecheck; `pnpm check:push`; CI green; production build green;
Docker/container gate if actually used by deployment. Do not invent new
mandatory checks just because they exist somewhere in the repository.

**Final DEV Browser Smoke** — verify real DEV, minimum: Homepage, Events
listing, Event detail, Places listing, Place detail, Blog / Articles
listing, Article detail, continuous reading, Routes, Search, Filters, My
Ideas, My Plan, Day Scenario, authentication, critical Business flows,
critical Admin flows. On relevant surfaces: desktop, mobile, images,
navigation, critical actions, console errors, hydration errors, critical
404, critical 500, metadata, structured data. Do not repeat the same smoke
meaninglessly many times.

---

## 19. PROD Readiness Decision

If any mandatory task has status `TODO`, `AUDIT_IN_PROGRESS`,
`AUDIT_COMPLETE` with unclosed confirmed gaps, `IN_PROGRESS`, `BLOCKED`, or
`COMPLETE_PENDING_BROWSER_SMOKE`, or there are unresolved P0/P1 findings, the
overall status is:

```
PROD: NOT READY
```

Only when Tasks 1–16 are `COMPLETE`, no P0/P1 remain, Task 17 is green, and
DEV browser smoke is green, may the status become:

```
DEV:  VERIFIED
PROD: READY_FOR_MANUAL_DEPLOY
```

This is **not** a PROD launch. Production deployment is performed by the
project owner manually, via Telegram. Coding agents must not initiate PROD
deployment themselves.

## 20. PROD Post-Deploy Smoke

```
PROD POST-DEPLOY SMOKE — NOT STARTED
```

Do not perform this now. After a manual PROD deployment, run a short
read-only verification: deployed SHA/version, homepage, critical public
flows, authentication, Business availability, Admin availability, key APIs,
media, migration status, errors, critical SEO, monitoring/logs. Any
subsequent PROD change is a separate, controlled task.

## 21. Execution Model For Every Task

Roughly five phases:

1. **AUDIT** — read-only. Record EXISTING / PARTIAL-BROKEN / MISSING / DO
   NOT TOUCH / minimal implementation scope. If the audit is itself a
   meaningful documented milestone, an atomic docs commit is acceptable.
2. **CORE GAP** — implement the confirmed core gap. Targeted verify. Green →
   commit.
3. **REQUIRED INTEGRATION** — only if genuinely needed: UI, API, Admin,
   analytics, migration/data compatibility, shared components. Verify.
   Green → commit.
4. **DEV / BROWSER VERIFICATION** — for user-facing flow: desktop, mobile,
   required behavior, relevant error states. Fix only real found problems.
   Green → commit.
5. **TASK CLOSURE** — task-level verification. Update this checklist's
   STATUS, AUDIT, GAPS, COMMITS, VERIFICATION, DEV SMOKE, BLOCKERS, BACKLOG
   links. If only a checklist update remains: atomic documentation commit.
   Never create empty commits.

## 22. Agent Coordination — Before Starting Any Task

1. Read `docs/release/dev-to-prod-checklist.md`.
2. Check the release status block.
3. Determine the active task.
4. Read existing AUDIT/GAPS/COMMITS/VERIFICATION for that task.
5. Check current Git state.
6. Run AUDIT FIRST.
7. Work only on confirmed gaps.
8. Use risk-based verification.
9. Make atomic commits after meaningful verified phases.
10. Update this checklist.
11. Route P2/P3 to backlog.
12. Do not change another task's status without a real check.
13. Do not expand the checklist with new nice-to-have tasks.

## 23. Stop Condition

Critical rule. When Tasks 1–16 are `COMPLETE`, there are no unresolved
P0/P1, P2/P3 are in the backlog, Task 17 is green, and DEV browser smoke is
green, DEV → PROD development under this checklist is **finished**. Set:

```
DEV:  VERIFIED
PROD: READY_FOR_MANUAL_DEPLOY
```

After that: do not start a new general audit, do not look for additional
improvements, do not start on the backlog, do not do cleanup "since there's
time", do not expand this checklist. Stop and hand readiness for manual PROD
deployment to the project owner.

## 24. Checklist Immutability Rule

See §17 above — repeated here for emphasis: after creation, only operational
fields (STATUS, AUDIT, GAPS, IMPLEMENTATION, COMMITS, VERIFICATION, DEV
SMOKE, BLOCKERS, confirmed P0/P1, backlog links, and the RELEASE STATUS
block) may be updated without a separate explicit owner decision.
