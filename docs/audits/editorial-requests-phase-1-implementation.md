# Editorial Requests Phase 1 Implementation

**Date:** 2026-06-14  
**Scope:** admin-only editorial request CRUD + matching preview  
**Out of scope:** Telegram, callbacks, billing, recipient acceptance, public UI

## 1. What was implemented

Phase 1 now supports:

1. admin list page for editorial requests
2. create page for a new editorial request
3. detail/edit page for an existing editorial request
4. request criteria storage:
5. title
6. description
7. city
8. status
9. optional deadline
10. criteria JSON with:
11. `discoverySignalIds`
12. `classChipSlugs`
13. grouped business preview based on published offers
14. human-readable match reasons per business

The matching path is intentionally the audited one:

`Offer.status = PUBLISHED -> offer criteria -> Place.ownerBusinessId -> Business`

## 2. New models / migration

### Prisma

Added:

1. `EditorialRequestStatus`
2. `EditorialRequest`

Schema changes live in:

1. [prisma/schema.prisma](/Users/shapovalovalexey/dev/mamago2/prisma/schema.prisma:2283)
2. [prisma/migrations/20260614120000_add_editorial_requests_phase1/migration.sql](/Users/shapovalovalexey/dev/mamago2/prisma/migrations/20260614120000_add_editorial_requests_phase1/migration.sql:1)

### Migration name

`20260614120000_add_editorial_requests_phase1`

## 3. New routes / files

### Admin pages

1. [src/app/admin/content/editorial-requests/page.tsx](/Users/shapovalovalexey/dev/mamago2/src/app/admin/content/editorial-requests/page.tsx:1)
2. [src/app/admin/content/editorial-requests/new/page.tsx](/Users/shapovalovalexey/dev/mamago2/src/app/admin/content/editorial-requests/new/page.tsx:1)
3. [src/app/admin/content/editorial-requests/[id]/page.tsx](/Users/shapovalovalexey/dev/mamago2/src/app/admin/content/editorial-requests/[id]/page.tsx:1)

### Admin API

1. [src/app/api/admin/editorial-requests/route.ts](/Users/shapovalovalexey/dev/mamago2/src/app/api/admin/editorial-requests/route.ts:1)
2. [src/app/api/admin/editorial-requests/[id]/route.ts](/Users/shapovalovalexey/dev/mamago2/src/app/api/admin/editorial-requests/[id]/route.ts:1)
3. [src/app/api/admin/editorial-requests/[id]/matches/route.ts](/Users/shapovalovalexey/dev/mamago2/src/app/api/admin/editorial-requests/[id]/matches/route.ts:1)

### UI / services

1. [src/components/admin/editorial/EditorialRequestEditorClient.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/admin/editorial/EditorialRequestEditorClient.tsx:1)
2. [src/components/admin/editorial/EditorialRequestMatchesPanel.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/admin/editorial/EditorialRequestMatchesPanel.tsx:1)
3. [src/components/admin/editorial/EditorialRequestStatusBadge.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/admin/editorial/EditorialRequestStatusBadge.tsx:1)
4. [src/lib/editorial/schemas.ts](/Users/shapovalovalexey/dev/mamago2/src/lib/editorial/schemas.ts:1)
5. [src/server/editorial/editorialRequestService.ts](/Users/shapovalovalexey/dev/mamago2/src/server/editorial/editorialRequestService.ts:1)
6. [src/server/editorial/editorialRequestMatchingService.ts](/Users/shapovalovalexey/dev/mamago2/src/server/editorial/editorialRequestMatchingService.ts:1)

### Navigation

Sidebar entry added in:

1. [src/lib/admin/adminSidebarConfig.ts](/Users/shapovalovalexey/dev/mamago2/src/lib/admin/adminSidebarConfig.ts:1)

## 4. Matching algorithm

The preview algorithm is intentionally minimal and explainable.

### Query rules

1. start from public published offers
2. require `Place.ownerBusinessId` to be non-null
3. if city is selected, constrain by `Offer.cityId` or `Place.cityId`
4. require at least one selected criterion
5. match when offer has:
6. `discoverySignalIds hasSome selectedSignalIds`
7. or `classChipSlugs hasSome selectedClassChipSlugs`

### Grouping

1. raw offers are grouped by business
2. places are deduplicated inside each business group
3. matched signals and class chips are intersected per offer
4. a plain-text `matchReason` is generated from the matched offers

### Safe behavior

If no criteria are selected, preview returns an empty instructional state instead of matching all businesses.

## 5. What is intentionally NOT implemented

1. no Telegram sending
2. no Telegram callback actions
3. no recipient model
4. no billing charge, hold, or balance mutation
5. no public page or public request flow
6. no business manual classification
7. no duplicate discovery taxonomy

## 6. How to test manually

1. Apply the migration and open `/admin/content/editorial-requests`.
2. Create a new request with title only and save.
3. Open the detail page and verify that preview asks for criteria instead of matching everything.
4. Select a city, one or more discovery signals and/or class chips, save again.
5. Verify that:
6. preview groups rows by business
7. one business is not duplicated
8. each business shows places and matched offers
9. each offer shows which signals/chips caused the match
10. global scope is explicit when city is empty

## 7. Known limitations

1. `criteria` is JSON, not normalized tables, by design for Phase 1 simplicity.
2. Preview refreshes after save; there is no live unsaved preview yet.
3. Matching uses active discovery taxonomy for form catalogs; there is no special UI for deprecated selections.
4. `createdById` is stored as scalar only; no user relation is modeled yet.
5. Build verification in this run did not produce a terminal completion signal and should be rechecked locally if needed.

## 8. Recommended Phase 2 next steps

1. add recipient model per business
2. add business-to-target-user resolution strategy
3. add Telegram delivery service for editorial requests
4. add callback mutation flow for accept/decline
5. keep billing for a later phase after review workflow is explicit
