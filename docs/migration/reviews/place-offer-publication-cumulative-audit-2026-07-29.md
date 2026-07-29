# Places/Offers LOCAL publication closure — cumulative audit — 2026-07-29

## Before (session start) → after (both batches complete)

```text
Place rows:                    83 → 83   (0 CREATE, 0 DELETE)
Place PUBLISHED:                5 → 81   (+76, exactly the manifest size)
Place PENDING:                 78 →  2   (the 2 CITY_BLOCKED remain, correctly)
Offer rows:                    63 → 63   (0 CREATE, 0 DELETE)
Offer PUBLISHED:                0 → 63
Offer DRAFT:                   63 →  0
active PLACE MigrationLineage: 82 → 82   (unchanged)
active OFFER MigrationLineage: 63 → 63   (unchanged)
MediaAsset:                   159 → 159  (unchanged — 0 media/storage writes)
PlaceImage:                    39 → 39   (unchanged)
```

## Invariant checklist

```text
unexpected Place CREATE:              0
unexpected Offer CREATE:              0
DELETE (either entity):               0
duplicate source keys (both):         0
duplicate slugs (both, city-scoped):  0
orphan media links:                   0
unexpected ownership changes:         0
unexpected city changes:              0
forbidden table changes:              0
media/storage writes:                 0 (the og-default.jpg fix is a static asset replacement, not
                                          a DB/storage write — see offer-publication-result §7)
production writes:                    0
```

## Code/asset changes this session

```text
src/app/(public)/places/[slug]/page.tsx        — PLACE_CANONICAL_METADATA_MISSING fix
src/lib/seo/resolvePlaceCanonicalUrl.ts        — new, extracted pure helper
src/lib/seo/resolvePlaceCanonicalUrl.test.ts   — new, 5 tests
src/server/services/moderation.service.ts      — new submitOfferForModeration()
src/server/services/submitOfferForModeration.test.ts — new, 6 tests
public/og-default.jpg                          — replaced 49-byte text stub with a real placeholder JPEG
```

Two temporary, local-only, non-production Next.js API routes were created solely to invoke the real
`approvePlace()`/`approveOffer()` lifecycle services from outside a plain script context (both
transitively require the Next.js bundler for a `server-only`-guarded import) — both deleted
immediately after their one-time use; neither is present in the final diff.

## Idempotency (both entities)

```text
Place: 76/76 ALREADY_PUBLISHED_RESYNCED on rerun, 0 writes beyond redundant canonical/search resync
       (values unchanged).
Offer: 63/63 ALREADY_PUBLISHED_RESYNCED on rerun, 0 writes beyond redundant canonical/search resync
       (values unchanged).
```
