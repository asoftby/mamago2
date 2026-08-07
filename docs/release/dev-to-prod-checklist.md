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

Active task:        Task 2 — Search Ranking (COMPLETE_PENDING_BROWSER_SMOKE)
Last updated:       2026-08-08
Last updated by:    Claude Code (Task 2 audit + word-order search fix; status
                     corrected pending owner-controlled DEV deploy + real-DEV
                     smoke of the fix itself)
Unresolved P0/P1:   none from Task 1 or Task 2 — Tasks 3–15 remain TODO, not started
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

STATUS: `COMPLETE_PENDING_BROWSER_SMOKE`
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
DEV SMOKE: **Incomplete — this is the sole remaining step.** Read-only
golden-set evaluation against real `https://dev.mamago.by` (Browser pane,
cookies declined to non-essential) proved the *bug* (exact match, partial
match, category word, "free"-text match, and the word-order/multi-word
failures all reproduced live). The *fix* was verified only against the
local dev server (`localhost:3000`, already running from a separate
session — reused rather than starting a second instance) via direct
`/api/search` fetch calls (before/after) and a full local UI pass: typed
`балет три поросенка` into the real `SearchOverlay` and confirmed
"С. Кибирова балет «Три поросенка»" renders correctly; `read_console_messages`
showed no new errors (only pre-existing, unrelated 401s from the guest
`/api/save/status` endpoint). Commits `68917508`/`7f7cc66d` are local to
this working tree only — not pushed, not deployed. Actual `dev.mamago.by`
still runs the pre-fix image and therefore still exhibits the word-order
bug right now. Per Task 2 Exit Criteria ("Search works reliably on real DEV
data"), this cannot be marked `COMPLETE` until the fix is verified on
actual DEV after an owner-controlled deploy — see BLOCKERS.
BLOCKERS: **DEV deploy pending (owner-controlled).** Task 2 status is held
at `COMPLETE_PENDING_BROWSER_SMOKE` until: (1) the project owner deploys
commits `68917508`+`7f7cc66d` (or whatever supersedes them) to
`dev.mamago.by`, and (2) a coding agent re-runs the same read-only
golden-set queries against actual `dev.mamago.by` and confirms the
word-order fix is live there. No other blocker.

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
BACKLOG-023 (mock admin stats), BACKLOG-024 (dead search-adjacent
scaffolding cleanup), BACKLOG-025 (uncalled `logSearchClick`). Search
click-through/CTR-as-a-ranking-signal work intentionally left for Task 5
(Content Analytics & Ranking) per this checklist's own task boundaries —
not started here.

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

STATUS: `TODO`
AUDIT: —
GAPS: —
IMPLEMENTATION: —
COMMITS: —
VERIFICATION: —
DEV SMOKE: —
BLOCKERS: —
BACKLOG/NOTES: —

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

STATUS: `TODO`
AUDIT: —
GAPS: —
IMPLEMENTATION: —
COMMITS: —
VERIFICATION: —
DEV SMOKE: —
BLOCKERS: —
BACKLOG/NOTES: —

AUDIT FIRST and reproduce the current problem. Check: Event Wizard, Place
selector, existing Place, new Place creation, autocomplete, Google Places
integration, city context, debounce/search, normalization, coordinates,
persistence, edit flow, tests. Find root cause first. Do not rewrite the
address system without necessity.

**Exit Criteria:** The editor reliably finds an address, selects an existing
Place, or creates a new Place inside the Event Wizard.

## TASK 5 — Content Analytics & Ranking

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
