# Offer LOCAL publication closure — result — 2026-07-29

Same worktree/branch as the Place result doc.

## Browser proof provenance

```text
branch:        feat/places-offers-publication-closure
HEAD:          74bcb483925d6c96a74eeb8ee9a0053b1b8a44f8
worktree path: /Users/shapovalovalexey/dev/mamago2-places-offers-publication
pwd (before launch): /Users/shapovalovalexey/dev/mamago2-places-offers-publication
launch command: rm -rf .next && npx next dev --webpack -p 3050
port:          3050
URLs checked:  http://localhost:3050/offers/paket-komfort (-> redirects to
               http://localhost:3050/minsk/offers/programs/paket-komfort)
               + all 63 published Offer slugs via automated HTTP check (§8)
```

No PID, cookie, session token, or other volatile runtime value is recorded above or elsewhere in
this doc.

## 1. `submitOfferForModeration()` — new lifecycle service

No existing DRAFT→PENDING submit path existed for Offer (unlike Place's `submitPlace()`). Added
`submitOfferForModeration(offerId, actor)` in `src/server/services/moderation.service.ts`, mirroring
`submitPlace()`'s existing shape:

```text
DRAFT -> PENDING only.
Idempotent on PENDING (returns alreadyPending: true, no write).
Throws on PUBLISHED, REJECTED, or archived (archivedAt set) — never silently no-ops.
actor: { type: "OWNER", userId } (ownership checked against Place.ownerBusiness.ownerUserId)
     | { type: "PRIVILEGED_MIGRATION" } (explicit bypass, never implicit)
Touches only Offer.status. Never Place, Business, city, title, slug, content, CTA, or media.
```

6 tests in `submitOfferForModeration.test.ts` (self-generated temporary fixtures, created and torn
down within the test file, per project convention): DRAFT→PENDING succeeds; PENDING rerun is a NOOP;
PUBLISHED cannot be resubmitted; wrong owner denied (and status unchanged); privileged-migration
actor bypasses ownership; Place/Business/relations/Offer-count unchanged (no CREATE).

**Not used**: the privileged Business PATCH endpoint's direct `DRAFT → PUBLISHED` capability — the
batch below goes through `submitOfferForModeration()` then the existing `approveOffer()`, exactly the
prescribed `DRAFT → PENDING → PUBLISHED` path.

## 2. Exact 63-key manifest

Built directly from the live DB (safe-canonical scope = active `OFFER` MigrationLineage, already
reconfirmed 63/63 in the prior session): [`offer-publication-manifest-2026-07-28.json`](./offer-publication-manifest-2026-07-28.json)
— **63 rows, 0 duplicate ids, 0 duplicate sourceRecordKeys**. Every row asserted (before writing the
manifest): `status=DRAFT`, linked Place exists with non-null `cityId`, `Offer.cityId` already
matches `Place.cityId` (confirmed from the prior session's backfill), not archived.

## 3. Preview → batch execution

Preview: 63/63 `SUBMIT_THEN_APPROVE`, 0 errors. Batch (same temporary local-only route pattern as
Places, `bulk-offer-publish-temp`, deleted after use): per Offer, sequentially —
`submitOfferForModeration()` → verify `PENDING` + protected-field hash → `approveOffer()` → verify
`PUBLISHED` + protected-field hash → `syncOfferCanonical()` → search reindex.

```text
Result: 63/63 PUBLISHED, 0 errors, 0 stop points, all in one pass.
```

## 4. Protected fields before/after

Every one of the 63 hash-verified (`title`, `placeId`, `cityId`, `businessId`) at three points: live
read before submit, after submit (still PENDING), after approve (now PUBLISHED). All matched
exactly at every checkpoint — no Place/Business/city drift anywhere in the 63.

## 5. Class H / Class I — untouched

Neither the 28 (missing Place relation) nor the 8 (noncanonical alias) records exist anywhere in the
local DB (never persisted, by design — confirmed in the prior session). Nothing to touch, nothing
touched; not part of this manifest.

## 6. Final DB counts

```text
Offer rows total:  63 (unchanged — 0 CREATE, 0 DELETE)
PUBLISHED:         63
DRAFT:              0
null slug:          0 (all 63 assigned during approveOffer's ensurePublishedOfferHasSlug)
null seoCanonicalUrl: 0
duplicate city-scoped slugs: 0
```

## 7. Media P1-defer runtime validation — found and fixed a real (pre-existing) defect

Checking a representative published Offer live turned up a genuine broken-image render: the
**shared fallback image** at `public/og-default.jpg` — used as both the OG/social-preview image
*and*, via `mapOfferPageMedia.ts`'s `FALLBACK_POSTER`, the actual on-page hero image shown in the
public content layout whenever an Offer (or Event, via the same constant elsewhere) has no cover —
was a **49-byte placeholder text file** (`"placeholder - replace with real 1200x630 OG image"`)
mislabeled `Content-Type: image/jpeg`, not a real image at all. Calling it just "the OG image" would
understate its role — it is rendered directly in the visible page layout, not only in `<meta>` tags.
Pre-existing, not Offer-specific, not introduced by this session, but it *does* fail the explicit
"no broken `<img>`" condition this closure's own media-defer approval requires.

**Fixed with an asset replacement, not a code change** — confirmed this is not a media
migration/storage write: no `MediaAsset` row, no `MigrationLineage` row, no database row of any kind
was touched; this is a static file under `public/`, served directly by Next.js, unrelated to the
Place/Offer media-import pipeline audited elsewhere in this closure.

```text
Before: 49 bytes, plain text content, Content-Type header claimed image/jpeg (false)
After:  1200x630 baseline JPEG, sRGB, 3 channels, no alpha, no ICC profile, 4769 bytes
        Decodes successfully (verified via `sharp(...).metadata()`)
        No EXIF/APP1 segment present (raw bytes start FFD8 FFDB — straight into the quantization
          table, no metadata segment at all) — no embedded location/device/text data
        Solid fill color (#EF8759) matching the site's own existing brand accent color
          (--color-primary in the app's own inline theme styles) — a synthetically generated,
          neutral, on-brand placeholder; not a third-party photo, no licensing concern
```

Re-verified live: clean solid placeholder renders in place of the broken-image icon, desktop and
mobile, 0 console errors, CTA ("Записаться") stays visible and prominent, no misleading fake photo.
**`OFFER_MEDIA_DEFERRED_P1: APPROVED`** — true only after this fix; it would not have been true
before it.

## 8. Public/canonical/search proof

Automated HTTP check, all 63 published Offers (following the `/offers/[slug]` → 
`/[city]/offers/[section]/[slug]` canonical redirect): **63/63 return 200, 63/63 have
`<link rel="canonical">` present, 0/63 are ID-based.**

Representative deep smoke (`Пакет: «Комфорт»`, a `hb-programs` Offer): correct title, price, linked
Place/Business name and address, 0 console errors, clean desktop and mobile render.

## 9. CTA — UI smoke vs end-to-end request (kept explicitly separate)

```text
CTA rendered:                    PASS — both "Записаться" and "Отправить заявку" render, visible,
                                  prominent, on every checked Offer page.
CTA opens expected form:         PASS — clicking opens the booking/request UI.
Client-side validation:          NOT TESTED — no form fields were filled/submitted this session.
Bounded local request creation:  NOT PERFORMED — no BookingRequest/contact-thread row was created.
Email/Telegram notification delivery: NOT PERFORMED.

CTA UI SMOKE:              PASS
CTA END-TO-END REQUEST:    UAT PENDING
```

Not declaring a full end-to-end CTA PASS from button visibility alone.

## 10. Authenticated business/admin UAT

Unauthenticated checks (`GET /api/business/offers/list` → 401) prove only that the auth gate exists
— they do **not** prove that a real owner sees their published Offer correctly, that a wrong owner
is denied read/edit access, or that ADMIN sees the correct Business/Place/status. Performing that
smoke would require either creating a new user, resetting a real user's password, or fabricating a
session — all explicitly prohibited for this task, and no existing safe local credentials for a
`BUSINESS_OWNER` tied to any of these 63 Offers were available this session.

```text
AUTHENTICATED BUSINESS/ADMIN UAT: NOT PERFORMED
```

Not declaring a full business/admin PASS. Recommended once real Business accounts (or a
project-approved test account with known credentials) are available to exercise this — ideally
against the integrated RC, not a repeat smoke of migration-created rows in this worktree.

## 11. Idempotency — precise rerun semantics

Reran the same publication route in commit mode a second time. As with Places (see the Place result
doc §7 for the underlying code-level reasoning — `syncOfferCanonical()` and
`SearchIndexerService.upsertOffer()` are structurally identical to their Place counterparts, both
unconditional writes with no before/after value comparison), the prior "63/63
`ALREADY_PUBLISHED_RESYNCED`, 0 writes" label undersold what happened:

```text
Offer lifecycle DB writes:   0   — neither submitOfferForModeration() nor approveOffer() is called
                                    on this path (status is already PUBLISHED); 0 status/placeId/
                                    cityId/businessId changes, confirmed by hash check against the
                                    manifest for all 63.
Offer canonical DB writes:  63   — syncOfferCanonical() unconditionally issued a prisma.offer.update()
                                    per Offer; seoCanonicalUrl value unchanged, Offer.updatedAt bumped.
Offer search-index writes:  63   — SearchIndexerService.upsertOffer() unconditionally upserted;
                                    SearchDocument content unchanged, its own updatedAt bumped.
Offer media/storage writes:  0
Unexpected PENDING rows:     0
Duplicate ids/sourceRecordKeys/slugs: 0 / 0 / 0
```

Correct classification: **`ALREADY_PUBLISHED_CANONICAL_AND_INDEX_RESYNC`** — not
`ALREADY_PUBLISHED_NOOP` (canonical and search writes are non-zero, even though the effective values
are unchanged and no lifecycle/relation/content field was touched).

## 12. Production execution

Not started (out of scope, no production writes performed anywhere in this session, per explicit
instruction).

## 13. Integrated RC revalidation

This entire proof was generated against this worktree in isolation. Per the checklist's
`BROWSER_PROOF_REVALIDATION_REQUIRED_ON_INTEGRATED_RC` note, this should be re-checked once merged
into a single integrated RC worktree alongside Articles/Users/UAT, Events, and Routes — not because
anything here is suspected wrong, but because that is the first point at which all branches' code
runs together in one process.
