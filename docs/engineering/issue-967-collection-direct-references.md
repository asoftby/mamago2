# #967 — CollectionItem direct references: audit and migration contract

Status: audit groundwork, **no schema migration or runtime changes in this PR**.

## Verified in dev/prisma/schema.prisma
- `Collection` is owned by `User`; `CollectionItem` has `collectionId` and five optional personal-save FKs: `ideaId`, `offerIdeaId`, `routeIdeaId`, `placeIdeaId`, `articleIdeaId`.
- Every current CollectionItem → *Idea relation is `onDelete: Cascade`. Thus deleting a saved idea may delete its membership in collections.
- `Idea.activityId`, `OfferIdea.offerId`, `RouteIdea.routeId`, `PlaceIdea.placeId`, `ArticleIdea.articleId` supply direct target identifiers. These five *Idea models store user ID, target ID, and createdAt; no separate user note was found in these models.
- `Wishlist` is unrelated gift-list functionality.
- Existing `PlanItem` has typed direct target fields; `UserEvent` is the analytics log.

## Desired independent collection membership
- Keep `Collection` and `CollectionItem`, their IDs and `addedAt` ordering.
- Add nullable typed target FKs (`activityId`, `offerId`, `routeId`, `placeId`, `articleId`) to `CollectionItem`; add target-side Prisma relation fields and indexes.
- During transition, keep old *Idea fields; after backfill, new readers/writers must use target FKs and **must not depend on Idea rows**.
- Unique per (`collectionId`, target FK) via partial unique indexes; exactly one target FK per row once backfilled. Avoid polymorphic unvalidated string IDs.
- Decide deletion policy for catalog objects before adding FK delete actions. Deleting a personal Idea must not delete collection membership.

## Required implementation sequence
1. **Complete reader/writer audit:** identify all API routes, service calls, UI paths, hearts, bulk operations, reorder, delete, and tests touching `CollectionItem`. GitHub code search did not reliably index these references; inspect checkout with ripgrep.
2. **Data diagnosis:** counts by each of five *Idea fields; missing targets, duplicates by target, rows with 0 or >1 idea FK; confirm activity referential integrity (the `Idea.activityId` field has no Prisma relation).
3. **Expand PR:** additive nullable target FKs, target relations and indexes; preserve existing writers.
4. **Backfill PR:** idempotent SQL updates by joins for five types, fail on unmapped rows, assert row count and identity preservation, test rerun and rollback.
5. **Switch PR:** read/write paths, bulk add/remove, heart semantics, ownership and ACL, removal of Idea no longer cascading into CollectionItem; add regression tests.
6. **Contract PR:** drop legacy FKs and associated relations only after DEV verification and data checks.

## Mandatory DEV acceptance
- Existing collection IDs, item IDs and ordering unchanged; no loss or accidental duplicate.
- Removing an item from My Ideas does not remove it from any collection.
- Adding to a collection does not create a My Ideas record.
- Removing a collection does not remove the underlying publication.
- Same publication may be in multiple collections, once per collection.
- No private collection or family information leaks.
- Concurrent writes and duplicate additions are handled; all five target types tested.
- SQL migrations verified on DEV with rollback and CI green.

This document records only confirmed schema observations and an implementation plan. It does **not** certify the API audit or migration as complete.
