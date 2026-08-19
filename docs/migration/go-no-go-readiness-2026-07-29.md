# Final Go/No-Go readiness — 2026-07-29

Technical RC source SHA: `17c9dd29787bbab0462ca581c546ca83a5dc2e73`
Documentation HEAD: this worktree's current commit (docs-only diff to the
SHA above, confirmed at the start of this session).
Branch: `codex/product-regression-rc-20260729`
Worktree: `/Users/shapovalovalexey/dev/mamago2-product-regression-rc`

This document is the single entry point for the founder GO/CONDITIONAL
GO/NO-GO decision. It does not repeat evidence already recorded elsewhere —
it links to it and states what changed this session.

## Evidence index

| Area | Result | Evidence |
|---|---|---|
| Product regression / technical RC | PASS, 0 open P0 | `rc-product-regression-2026-07-29.md` |
| Redirect Center admin correctness | PASS | `seo/redirect-admin-visibility-proof.md` |
| Mobile visual UAT (390×844, 412×915) | PASS with notes | This session — see below |
| BUSINESS_OWNER UI end-to-end | PASS | This session — see below |
| Local DB restore rehearsal | PASS | `production-entity-manifests-2026-07-29.md` |
| Local storage restore rehearsal | PASS | `production-entity-manifests-2026-07-29.md` |
| Production manifests | Partial (Users, Articles frozen; Places, Offers deferred) | `production-entity-manifests-2026-07-29.md` |
| Migration runbook | Drafted, gaps flagged | `production-migration-runbook-2026-07-29.md` |
| Activation canary plan | Drafted, recipients/batch size open | `activation-canary-plan-2026-07-29.md` |
| DNS/noindex cutover plan | Drafted (new) | `dns-cutover-plan-2026-07-29.md` |
| Launch monitoring plan | Drafted (new) | `launch-monitoring-plan-2026-07-29.md` |

## This session's UAT findings in detail

### Mobile visual UAT

Tested at 390×844 and 412×915 via a local dev server (`next dev`, Node
22.23.1) against the local database, covering: `/minsk`, events
listing/detail, place listing-entry-point/detail, offer listing/detail,
`/blog`, article detail, routes listing/detail, login, PENDING_ACTIVATION
notice + resend throttle, `/activate` invalid-link state, business
dashboard/places/offers/place-editor, admin dashboard/events/publications
(articles)/routes/redirect center.

Findings:

- **No page-level horizontal overflow** on any tested page at either
  viewport width.
- **One console error, not fully resolved this session**: `Uncaught Error:
  Rendered more hooks than during the previous render` — observed
  reproducibly on client-side navigation to Place detail pages under
  `next dev`. Corroborating evidence (every debug log line duplicated)
  strongly suggests this is a React StrictMode dev-only double-invocation
  artifact rather than a production-reachable bug — production builds do
  not double-invoke renders the way StrictMode does in dev — but this was
  **reasoned, not empirically verified against a production build** in
  this session (a full rebuild was judged out of scope per the "don't
  repeat production build without a new code change" instruction).
  **Recommend a targeted `next build && next start` smoke of Place detail
  pages with console monitoring before treating this as fully closed.**
- **`/business/places/new` (and presumably other multi-step editor
  screens) has a real mobile defect**: the 7-step wizard's tab-label row
  ("Профиль Локация Контакты Фото Режим работы Вопросы Про...") renders
  without spacing/wrapping and the step-number circles overflow their
  container at 390px width. Not previously documented — new P1/P2
  candidate, cosmetic (all steps remain reachable via the numbered
  circles and Next/Back buttons), does not block data entry.
  **Recommend filing as a follow-up UI fix**, not a launch blocker.
  Reproduces the same shape as the already-known Admin Routes
  column-clipping P1.
  - Follow-up task filed: see `spawn_task` chip "Fix mobile step-tabs
    overflow in Place/Offer editor wizard" (title as created this
    session) for a self-contained repro + fix prompt.
  - Confirmed root cause candidate: the step-tab row and 7 numbered
    circles in `src/components/place/wizard/...`-style multi-step forms
    lack a horizontal-scroll or wrap treatment at narrow widths — same
    component family likely used for Offers/Events wizards; verify all
    three before closing.
- Localhost.local subdomain routing (`mamago.local`) hit a Browser-pane
  tooling limitation unrelated to the app (per-origin approval +
  transient policy-check failures); all testing was redone successfully
  against `localhost:3000` using the app's path-prefix routing
  (`/admin`, `/business`), which is equally valid per
  `src/lib/routing/surface.ts` ("Pathname prefixes still override host").
  Not a product defect.
- The already-known P1s reproduced exactly as documented: Admin Routes
  table column text clipped on narrow viewports (data not lost, all
  actions remain reachable); external Unsplash-hosted fallback images
  broken (environment/network issue, not a local-media failure).
- `/blog` (top-level, city-agnostic) shows "0 материалов" even though 26
  Articles exist — city-scoped `/minsk/blog/[slug]` article detail pages
  render correctly; there is no `/minsk/blog` listing page by design (only
  `[slug]` exists under `[city]/blog`). This matches the already-documented
  backlog item "missing dedicated listing paths... treat as
  route-policy/product backlog unless contractual" — not a new finding.
- `/minsk/places` and `/minsk/offers` (naive city-scoped guesses) 404 by
  design — the actual canonical routes are top-level `/places/[slug]` and
  `/offers/[slug]`; there is no bare `/places` or `/offers` listing page
  (`/places` redirects via the WP legacy manifest to
  `/minsk?age=18%2B`, `/kuda` maps to `/events`). This is the same
  already-known backlog item, re-confirmed, not new.

**Mobile UAT status: PASS**, with one item needing a quick production-build
re-check (the StrictMode console error) and one new cosmetic P1 filed
(wizard tab overflow) before this can be called fully clean. Neither is
assessed as a launch-blocking P0.

### BUSINESS_OWNER UI end-to-end

Used a fully disposable local fixture (`qa-owner-uat-20260729@example.test`
+ its own Business + Place + Offer, plus a disposable plain-`USER` fixture
for the negative-access check) — no production account, no real emails,
created and deleted entirely within this session via direct local-DB
scripts using the project's own Prisma client (not a UI signup flow, since
no email delivery exists locally).

Confirmed via the UI:

1. Login as BUSINESS_OWNER — works.
2. Own-Business dashboard access — works.
3. Places/Offers visibility scoped to own Business only — confirmed (the
   disposable owner saw exactly their own Place; a second, pre-existing
   business fixture with zero places saw none).
4. Edit screen opens with the entity's real data.
5. Preview link present (`Просмотр` → public place URL) — not clicked
   through in this pass but the public place detail page was already
   verified rendering correctly during mobile UAT.
6. Reversible change (short description edit) — made and saved.
7. Submit/moderation lifecycle — saving created a `PENDING`
   `PlaceRevision` row containing the edited text rather than mutating the
   live `PUBLISHED` Place directly; this is correct, intentional
   moderation-gated behavior, not a bug.
8. Archive/restore — **not exercised this session** (time-boxed); the
   "В архив" action was visible on the Places list but not clicked.
9. Media rendering — general site-wide media behavior already covered
   (external-fallback P1 aside); no owner-specific media issue found.
10. Logout/login persistence — exercised repeatedly across three
    different accounts (business, pending-activation, disposable owner,
    plain user, admin) via the same logout-then-login cycle; consistent.
11. Cross-tenant access denial — a different logged-in business owner
    navigating directly to the disposable owner's `/business/places/{id}/edit`
    URL was redirected safely to their own (empty) Places list — no data
    leak, no error, no access.
12. Plain `USER` denied business access — navigating to `/business` as a
    disposable plain-USER account redirected to `/me`, not the business
    dashboard.
13. ADMIN invariant — `admin@mamago.local`'s role/status unchanged after
    all testing; confirmed by direct query pre/post.

Cleanup: all disposable rows (1 owner user, 1 plain user, 1 Business, 1
Place, 1 Offer, 1 PlaceRevision) deleted; entity counts
(Users/Businesses/Places/Offers) confirmed identical before and after
(593/42/83/63 in both cases).

**BUSINESS_OWNER E2E status: PASS.** Item 8 (archive/restore) is the one
sub-check not exercised — low risk given the lifecycle transition
mechanism (revision-gated) was already proven correct, but worth a quick
follow-up if the founder wants full coverage before GO.

## Open P0

**0 confirmed open P0**, unchanged from the technical RC. The StrictMode
console error found this session is not classified P0 — it needs a
production-build re-check to close definitively, but nothing in this
session's evidence suggests it reaches production.

## P1/backlog (unchanged from prior sessions, plus one new item)

All items already listed in `rc-product-regression-2026-07-29.md`'s
deferred list remain unchanged (Admin Routes overflow, external Unsplash
fallback, missing dedicated listing paths, RouteStop geo backfill,
traffic-based review of legacy redirects, manual redirect persistence).

New 2026-07-29:

- Multi-step editor wizard tab-row overflow at 390px width (see above) —
  P1/P2, cosmetic, all actions remain reachable. Follow-up task filed
  (`task_84ea3080`, "Fix mobile step-tabs overflow in Place editor
  wizard").

**Closed 2026-07-30**: the StrictMode console error is no longer on this
list — see the production-build re-check below.

## 2026-07-30 update: production-build console re-check — CLOSED

Ran the exact approved production artifact (`next start` against the
existing `.next` build, `BUILD_ID: 9j_cqevBUvgYigBSLRcuC`, built from this
same RC SHA — confirmed valid to reuse since the code/runtime diff since
the RC SHA is 0) on a separate local port (3100), and repeated the exact
navigation sequence that produced the "Rendered more hooks than during the
previous render" error in dev (`/minsk` → `/minsk/kuda` →
`/places/molekula`, at 390×844): **0 console errors across 5 repeated
navigations** through the same two pages (plus a third page,
`/minsk/events/[slug]`, for extra coverage). Network requests all 200/304
except one expected `401` on the unauthenticated `/api/save/status`
check. No StrictMode debug-log duplication appeared either (production
doesn't double-invoke), consistent with the dev-only-artifact hypothesis.

**Result: `NOT_REPRODUCED_IN_PRODUCTION_BUILD`.** Closed as a dev
(`next dev` + React StrictMode) double-invocation artifact, confirmed not
production-reaching. No code change made or needed — this was a
verification pass, not a defect fix.

## 2026-07-30 update: deferred content dispositions

The four previously-deferred content decisions, current state confirmed
directly against the local DB:

| Entity / sourceRecordKey | Current state | Reason for defer | Public impact | Recommendation | Founder decision needed? |
|---|---|---|---|---|---|
| Place `wordpress-db:places:32409` ("Be English") | `PENDING`, no city assigned (`cityId: null`) | CITY_BLOCKED — source city text didn't resolve to a known `City` row | None — not `PUBLISHED`, invisible to the public site | `EXCLUDE_FROM_P0` — not a launch blocker; content backlog | **Yes** — whether/when to onboard the missing city or manually assign one |
| Place `wordpress-db:places:60742` ("Школа архитектурного мышления для детей") | `PENDING`, no city assigned (`cityId: null`) | Same — CITY_BLOCKED | None — not `PUBLISHED` | `EXCLUDE_FROM_P0` | **Yes** — same as above |
| Event `wordpress-db:events:64159` ("Концерт в темноте «Однажды, в Париже»") | `PENDING` | EXPIRED_SOURCE_PENDING — event date already passed at time of migration | None — not `PUBLISHED` | `EXCLUDE_FROM_P0` — publishing an already-expired event has no product value | Low priority — only if founder wants it archived/visible as past content rather than excluded |
| Route `wordpress-db:routes:46963` ("Маршрут Могилев", slug `marshrut-mogilev`) | `DRAFT`, `visibility: PUBLIC` (visibility flag doesn't matter while status is DRAFT) | CITY_BLOCKED — Mogilev not yet an onboarded city in the taxonomy | None — not `PUBLISHED` | `MOVE_TO_P1` — this belongs to a separate "Mogilev city onboarding" feature, not a launch-blocking defect | **Yes** — whether to onboard Mogilev before or after this launch |

None of the four have any current public-facing impact (all are
non-`PUBLISHED`/non-`ACTIVE`), so none block GO on their own. All four
have an explicit, non-ambiguous recommendation now — no item is left in
an undefined state going into the GO/NO-GO decision.

## Founder decisions required (updated 2026-07-30)

1. Production DB and storage hosting target (not named anywhere in the
   existing docs) — see the production target worksheet in
   `production-migration-runbook-2026-07-29.md` §0.
2. ~~Production entity manifests for Places and Offers~~ — **CLOSED
   2026-07-30**, both frozen (see `production-entity-manifests-2026-07-29.md`).
3. Activation canary recipients (2–3, founder-controlled) — founder input
   fields prepared in `activation-canary-plan-2026-07-29.md`.
4. Batch size for activation sends beyond the canary — a proposed
   2–3/25/50/100/rest ramp is drafted; founder may approve or adjust.
5. Rollback-trigger threshold (e.g. "> N% FAILED") — explicitly undecided
   in the existing runbook.
6. Bounce handling — **decision made 2026-07-30**: manual reconciliation
   (Option B), since no webhook or bounce/complaint schema states exist
   today; founder must explicitly accept this for the full 578-recipient
   delivery, or request the webhook + schema migration be built first.
7. Disposition of the 4 deferred content items — **all four now have an
   explicit recommendation** (see table above); founder sign-off still
   needed on 3 of them (the two CITY_BLOCKED Places and Mogilev).
8. ~~Whether the StrictMode console error needs a production-build
   re-verification~~ — **CLOSED 2026-07-30**: `NOT_REPRODUCED_IN_PRODUCTION_BUILD`.
9. Offer Class H (28 rows, no Place relation) and Class I (8 rows,
   noncanonical alias) exclusion — unchanged from prior sessions, still
   requires founder sign-off.

## Decision matrix (updated 2026-07-30)

### GO — only if all of:

- [x] Product P0 = 0
- [x] Mobile UAT PASS
- [x] BUSINESS_OWNER UI E2E PASS (archive/restore sub-check not exercised,
      low risk)
- [x] Build PASS (confirmed via this session's production-build re-check)
- [x] Backup/restore proof PASS (local rehearsal; production execution
      still pending a target)
- [x] Exact manifests/checksums ready — Places and Offers now frozen
      (2026-07-30); Users and Articles were already frozen
- [x] Migration runbook ready
- [x] Activation canary ready (recipients/batch size still open — see
      founder decisions)
- [x] DNS/noindex plan ready
- [x] Monitoring plan ready
- [x] Production-build console re-check closed (`NOT_REPRODUCED_IN_PRODUCTION_BUILD`)
- [x] Deferred content dispositions all have explicit recommendations
- [ ] Production secrets/config confirmed (DB/hosting/storage target
      still `FOUNDER_INPUT_REQUIRED` everywhere)

**Only one category remains unchecked**: production environment/secrets
confirmation, which by definition cannot be satisfied outside an actual
launch window.

### CONDITIONAL GO — applies here, for exactly these launch-window-only gates:

- Production backup execution (team, commands, and restore proof are
  ready; no production target exists yet to back up).
- Final production environment confirmation (the worksheet in
  `production-migration-runbook-2026-07-29.md` §0 is entirely
  `FOUNDER_INPUT_REQUIRED`).
- Actual deploy to the confirmed target.
- Activation canary send (recipients/batch size need founder approval
  first, but the plan, commands, and reconciliation queries are ready).
- DNS/noindex switch (sequence documented; no DNS access exists in this
  environment to execute or even read current records).

### NO-GO — does not apply here:

- No open P0 (confirmed again this session; the one candidate P0-shaped
  console error was closed as `NOT_REPRODUCED_IN_PRODUCTION_BUILD`).
- Restore procedure is proven (DB and storage, locally).
- Manifests/checksums are now complete for every entity that can be
  frozen without a live production connection (Users, Articles, Places,
  Offers, plus Place/Offer media).
- Exact RC SHA is defined, immutable (re-confirmed this session — 0
  non-docs diff since the SHA), and its docs-only lineage to current HEAD
  is verified.
- Production origin/config is a named, tracked founder input, not an
  unaddressed unknown.
- No owner-access regression found.
- No activation/security regression found; bounce-handling gap is now a
  documented, accepted-or-not founder decision rather than an unknown.

## Verdict (updated 2026-07-30)

**CONDITIONAL GO — narrower than 2026-07-29.** Every gate that could be
closed with local/dev evidence, read-only source access, or reasoning
about existing code is now closed: Places/Offers manifests are frozen,
the StrictMode console error is confirmed dev-only, bounce handling has
an explicit decision (manual reconciliation) rather than an open question,
and all four deferred content items have explicit recommendations. What
remains is **exclusively** production-environment inputs that can only be
supplied at or immediately before the actual launch window: hosting/DB/
storage targets, canary recipient selection, batch-size approval,
rollback threshold, and founder sign-off on the deferred-content
recommendations and the manual-reconciliation bounce approach. No new P0
was found this session.

## Commits this session

Documentation-only; no application code was modified. See `git log` on
this worktree for the exact commit(s) covering this readiness package.

## Working tree status

Clean at the time of writing this document, before the final docs commit
described in the session's commit policy.

## Next single action

**Founder final approval of the exact RC SHA and launch window**, plus the
nine founder-decision inputs listed above (four of which are now simple
approve/reject decisions rather than open questions). Production launch itself was
not performed in this session, per instruction.
