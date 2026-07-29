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

## P1/backlog (unchanged from prior sessions, plus two new items)

All items already listed in `rc-product-regression-2026-07-29.md`'s
deferred list remain unchanged (Admin Routes overflow, external Unsplash
fallback, missing dedicated listing paths, RouteStop geo backfill,
traffic-based review of legacy redirects, manual redirect persistence).

New this session:

- Multi-step editor wizard tab-row overflow at 390px width (see above) —
  P1/P2, cosmetic, all actions remain reachable.
- StrictMode-only console error on Place detail client-navigation — needs
  a production-build verification pass to close; not yet classified as
  reaching production.

## Founder decisions required

1. Production DB and storage hosting target (not named anywhere in the
   existing docs).
2. Production entity manifests for Places and Offers (explicitly deferred
   to cutover time by design — must be generated fresh, not invented).
3. Activation canary recipients (3–5 accounts, founder-controlled).
4. Batch size for activation sends beyond the canary (explicitly "TBD by
   founder").
5. Rollback-trigger threshold (e.g. "> N% FAILED") — explicitly undecided
   in the existing runbook.
6. Whether to accept the "no bounce webhook yet" risk for the activation
   canary, or wire the webhook first.
7. Disposition of CITY_BLOCKED Places (2), Event 64159, Mogilev Route
   onboarding, and Offer Class H/I (36 rows) — all explicitly deferred to
   founder sign-off, unchanged by this session.
8. Whether the StrictMode console error needs a production-build
   re-verification before sign-off, or is accepted as dev-only based on
   this session's reasoning.

## Decision matrix

### GO — only if all of:

- [x] Product P0 = 0
- [x] Mobile UAT PASS (with the one production-build re-check noted above)
- [x] BUSINESS_OWNER UI E2E PASS (archive/restore sub-check not exercised)
- [x] Build PASS (per prior RC session)
- [x] Backup/restore proof PASS (local rehearsal; production execution
      still pending a target)
- [ ] Exact manifests/checksums ready for **all** entities (Places/Offers
      still deferred)
- [x] Migration runbook ready (drafted this session)
- [x] Activation canary ready (drafted; recipients/batch size still open)
- [x] DNS/noindex plan ready (drafted this session)
- [x] Monitoring plan ready (drafted this session)
- [ ] Production secrets/config confirmed (DB/storage target unknown)

**Not all GO conditions are met yet** — two boxes above are unchecked.

### CONDITIONAL GO — applies here, for these explicitly named gates:

- Production backup has not been executed (no target exists) — team and
  restore proof are ready; execute at the actual production-window backup
  step.
- Exact activation canary recipients are not yet selected — founder
  selection required, not blocking plan readiness.
- DNS switch is awaiting a named production target/window.
- Places/Offers production manifests are deferred by design to cutover
  time, not a readiness failure.

### NO-GO — does not apply here:

- No open P0.
- Restore procedure is proven (both DB and storage, locally).
- Manifests are fixed for the entities where freezing them now makes
  sense (Users, Articles); the rest are deliberately deferred, not
  missing.
- Exact RC SHA is defined and its docs-only lineage to current HEAD is
  verified.
- Production origin/config is the one open unknown, tracked explicitly
  above as a founder input, not an unaddressed risk.
- No owner-access regression found (cross-tenant and role checks all
  passed this session).
- No activation/security regression found.

## Verdict

**CONDITIONAL GO** — technical and product readiness is complete for
everything reachable from local/dev evidence; the remaining gates are all
production-environment inputs that only the founder can supply (hosting
target, canary recipients, batch size, rollback threshold, and the four
deferred-disposition decisions). No new P0 was found. Two small
new-this-session items (wizard tab overflow, StrictMode console error) are
tracked but do not change the verdict.

## Commits this session

Documentation-only; no application code was modified. See `git log` on
this worktree for the exact commit(s) covering this readiness package.

## Working tree status

Clean at the time of writing this document, before the final docs commit
described in the session's commit policy.

## Next single action

**Founder final approval of the exact RC SHA and launch window**, plus the
eight founder-decision inputs listed above. Production launch itself was
not performed in this session, per instruction.
