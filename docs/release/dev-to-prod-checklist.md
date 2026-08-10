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

Active task:        Task 5 — Content Analytics & Ranking (IN_PROGRESS —
                     AUDIT_COMPLETE + narrow owner-approved correction
                     implemented, DEV deploy pending)
Last updated:       2026-08-10
Last updated by:    Claude Code — Task 5 audit found a real, already-shared
                     UserEvent-derived ranking engine (kudaDiscoveryFeed /
                     classesDiscoveryFeed / planSuggestions, plus the real
                     Boost model for paid Offer visibility) already meeting
                     the task's exit criteria, alongside a confirmed
                     PLAN_ADD/SAVE weight-ordering bug and a dead, conflicting
                     second weight table. Owner narrowed scope to: fix the
                     weight ordering, consolidate to one canonical weight
                     table, retire the dead one — explicitly no
                     personalization, no new ranking layer, no ratings
                     wiring, no Stories-rail changes. Implemented + tested
                     + committed (`d5b149bc`); pushed for CI/Docker, SHA to
                     follow once green. Prior session (Task 4 closure):
                     Audited the full Event
                     Wizard address flow end-to-end before touching code,
                     proved the root cause was NOT the autocomplete dropdown
                     (it worked fine) but silent data loss — googlePlaceId,
                     Google address components, and auto district/metro
                     were dropped at client-side type boundaries and
                     hardcoded to null when a new Place was created at
                     publish time, even though the visible address
                     text/coordinates were always correct. Fixed by
                     threading the already-captured Google data through and
                     reusing Place Wizard's existing `/api/geo/enrich-location`
                     endpoint for district/metro (`de4d694a`). During DEV
                     verification, separately discovered and fixed a
                     pre-existing build-pipeline gap affecting ALL Google
                     Maps features on every previously-built DEV/PROD image
                     (not Task-4-specific — proven via the untouched Place
                     Wizard failing identically): `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`/
                     `MAP_ID` were never passed as Docker build-args, so
                     Next.js baked `undefined` into the client bundle
                     regardless of the container's runtime env. Fixed
                     `Dockerfile` + `.github/workflows/docker.yml`, set the
                     two GH Actions secrets from local `.env.local` (values
                     never printed), pushed (`5bd4371b`), CI+Docker Build &
                     Push green (`dev-269`). Owner redeployed DEV; SHA
                     confirmed live via `docker inspect`. Full DEV smoke
                     green on actual `business.dev.mamago.by` with real
                     Google Places API + real Minsk addresses: existing-Place
                     flow, new-Place-via-Google (DB-verified googlePlaceId/
                     addressJson/district/metro/coords), address-change
                     (second Place correctly created, original untouched,
                     EventVenue repointed), no-result graceful state, zero
                     console/network errors on a clean tab. All DEV test
                     records cleaned up. Three smaller non-blocking
                     follow-ups (address-component format mismatch in the
                     geo-enrichment fallback path; `EventLocationPicker.tsx`
                     dead code; Place Wizard's deprecated Autocomplete
                     widget) recorded as BACKLOG-038/039/040.
Unresolved P0/P1:   none from Task 1, 2, 3, 4, or 5 (Task 5's own audit found
                     zero P0/P1) — Task 5 IN_PROGRESS (narrow scope), Tasks
                     6–15 remain TODO, not started
```

Do not hand-wave this block. It must reflect the actual current state of
Tasks 1–15 below, not aspiration or memory of a prior session.

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
release scope (Tasks 1–15) is satisfied, only problems that genuinely affect
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

After creation, the main release scope (Tasks 1–15, their Exit Criteria, and
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

A new finding may be added as a sub-item of an existing Task 1–15 only if the
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
- **Before PROD readiness** — a full final gate (Task 15) is mandatory.

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

Every Task 1–15 below uses this compact template. Do not turn it into an
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
(not the full Task 15 site-wide smoke). Place detail
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
BACKLOG-037 with the PROD-side requirement flagged for Task 12
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

STATUS: `IN_PROGRESS`
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
DEV SMOKE: Not applicable in the usual browser sense — this is a
backend-only ranking-weight correction with no new UI surface; its effect
(Events with more `PLAN_ADD`s now correctly outranking otherwise-equal
Events with more `SAVE`s) is proven by the DB-backed targeted tests above,
not something a single-session browser click-through could reliably
demonstrate without fabricating a large synthetic event volume. Pending:
push to `origin/dev`, CI + Docker Build & Push green, owner-controlled DEV
deploy per standing process (this agent does not deploy) — SHA to be
recorded here once pushed.
BLOCKERS: none code-side. Deployment is owner-controlled via the standing
process.
BACKLOG/NOTES: BACKLOG-041 (ratings/reactions not wired into ranking —
needs a normalized/signed quality-signal design, deliberately deferred:
treating mere feedback existence as a positive signal would incorrectly
boost negative `PlaceReview`/`RouteRating`/`ArticleRating` submissions),
BACKLOG-042 (`UserBehaviorProfile.segmentKeys` unused for ranking
personalization — deliberately deferred, no `NEW_USER`/`SAVER`/`PLANNER`
feed branching this task), BACKLOG-043 (second dead Stories-rail redesign —
needs a separate owner decision: finish wiring or delete), BACKLOG-044
(`Occasion.boostScore` only applied to Events, not Offers/Places/Articles/
Routes), BACKLOG-045 (duplicated today/weekend date-range logic, Stories vs.
discovery filters), BACKLOG-046 (`StoryIntentConfig.itemLimit`/
`allowedTypes` dead sub-fields), BACKLOG-047 (`SignalDefinition.isFeatured`/
`EventCategory.isFeatured` dead admin flags), BACKLOG-048
(`Plan.hasPriorityBoost`/`PRIORITY_BOOST` scaffolding with zero callers and
zero business-facing marketing surface — confirmed not currently sold,
verified by grep across all business UI/API directories, so not a
false-advertising risk, just dead plumbing). None blocks Task 5's Exit
Criteria; none reopens Tasks 1–4.

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

STATUS: `TODO`
AUDIT: —
GAPS: —
IMPLEMENTATION: —
COMMITS: —
VERIFICATION: —
DEV SMOKE: —
BLOCKERS: —
BACKLOG/NOTES: —

AUDIT FIRST existing Share / My Ideas / My Plan / CTA / saved-state
functionality. Ensure: Share, Save to "My Ideas", Add to "My Plan" wherever
logically applicable. Check: article card, article detail, continuous
reading, authenticated user, guest, analytics, synchronization, mobile,
desktop. Reuse existing universal action components.

**Exit Criteria:** Actions work consistently across all relevant article
surfaces.

## TASK 7 — Day Scenario

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

---

# PART II — INFRASTRUCTURE READINESS

## TASK 12 — Environment Parity / PROD Configuration

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

## TASK 13 — Deployment & Rollback Readiness

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

## TASK 14 — Final Release Safety Audit

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

Start only after Product + Infrastructure readiness tasks (1–13) are
complete. Goal is NOT to find everything that could be improved in the
repository — it is to determine whether anything makes the first PROD
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

## TASK 15 — Final DEV → PROD Gate

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

Start only after Tasks 1–14 are complete and no unresolved P0/P1 remain.
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

Only when Tasks 1–14 are `COMPLETE`, no P0/P1 remain, Task 15 is green, and
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

Critical rule. When Tasks 1–14 are `COMPLETE`, there are no unresolved
P0/P1, P2/P3 are in the backlog, Task 15 is green, and DEV browser smoke is
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
