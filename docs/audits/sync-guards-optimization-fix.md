# Sync Guards Optimization Fix

Date: 2026-05-19
Scope: event session sync, event gallery sync, place subcategory sync
Follows: Phase 6C (`docs/audits/event-business-save-revalidation-fix.md`)

## Task A — Event schedule/session sync guard

**File:** `src/app/api/business/events/[id]/route.ts`
**Helper:** `src/lib/business/syncEventActivitySessions.ts`

### Guard already in place — confirmed, no changes needed

The route computes a two-part fingerprint guard before calling any session replacement:

```typescript
const nextScheduleFingerprint = eventSessionScheduleFingerprint(nextScheduleJson);
const activitySessionsNeedResync =
  eventSessionScheduleFingerprint(existing.scheduleJson) !== nextScheduleFingerprint ||
  eventSessionFingerprintFromStoredSessions(existing.sessions) !== nextScheduleFingerprint;
```

Part 1 detects when incoming scheduleJson changes the date/time fingerprint compared to the stored value.
Part 2 detects when stored sessions are already out of sync with the incoming fingerprint (repair guard).

Both `replaceActivitySessionsFromScheduleJson` (deleteMany + createMany) and `syncActivityNextOccurrenceAt` (findFirst + update) are inside `if (activitySessionsNeedResync)` and do not run when the fingerprint is unchanged.

`eventSessionScheduleFingerprint` extracts only session-driving fields (dates + startTime) from scheduleJson, so metadata-only changes (organizer snapshot, timezone text, etc.) do not trigger session replacement.

The `existing` snapshot already includes `sessions: { select: { startsAt: true } }` ordered by `startsAt`, so the fingerprint comparison reads no extra queries.

**Status:** fully guarded, no code changes made.

## Task B — Event gallery sync guard

**File:** `src/app/api/business/events/[id]/route.ts`
**Helper:** `src/lib/business/syncEventGalleryFromMediaIds.ts`

### Guard already in place — confirmed, no changes needed

The route calls `activityGalleryMatchesIncomingMediaIds` before any replacement:

```typescript
if (body.galleryMediaIds !== undefined) {
  const galleryUnchanged = await activityGalleryMatchesIncomingMediaIds(
    saved.id, incomingGallery, coverForGallery,
  );
  if (!galleryUnchanged) {
    await replaceActivityGalleryFromMediaIds(saved.id, incomingGallery, coverForGallery);
    galleryTouched = true;
  }
}
```

`replaceActivityGalleryFromMediaIds` (deleteMany + sequential creates in transaction) only runs when `galleryTouched = true`.

`syncActivityMediaUsage` is gated behind `mediaChanged`, which requires `galleryTouched = true` or a real cover change — so media usage sync is also skipped when gallery is unchanged.

The comparison in `activityGalleryMatchesIncomingMediaIds` resolves each incoming media reference and compares ordered (url, mediaAssetId) pairs against stored rows. If lengths or any position differs, it returns `false` and replacement runs.

**Status:** fully guarded, no code changes made.

## Task C — Place subcategory sync guard

**File:** `src/app/api/business/places/[id]/route.ts`

### Guard was missing — added

**Before (always ran on any `body.subcategoryIds`):**

```typescript
if (Array.isArray(body.subcategoryIds)) {
  const subcategoryIds: string[] = body.subcategoryIds.slice(0, 3);
  await prisma.placeSubcategory.deleteMany({ where: { placeId: id } });
  if (subcategoryIds.length > 0) {
    await prisma.placeSubcategory.createMany({ ... });
  }
}
```

Every autosave that included `subcategoryIds` in the payload — even if unchanged — caused a `deleteMany` followed by `createMany`.

PlaceWizard autosaves every 2 seconds for published places in edit mode (confirmed in Phase 6A audit), making this the most impactful guard gap.

**After (skips replacement when unchanged):**

```typescript
if (Array.isArray(body.subcategoryIds)) {
  const incomingIds: string[] = body.subcategoryIds.slice(0, 3);
  const existingIds = existing.subcategories.map((s) => s.categoryId);
  const subcategoriesUnchanged =
    incomingIds.length === existingIds.length &&
    incomingIds.every((categoryId, i) => categoryId === existingIds[i]);

  if (!subcategoriesUnchanged) {
    await prisma.placeSubcategory.deleteMany({ where: { placeId: id } });
    if (incomingIds.length > 0) {
      await prisma.placeSubcategory.createMany({ ... });
    }
  }
}
```

**Why ordered comparison**: `PlaceSubcategory` has a `position` column that drives display order. Incoming array index maps directly to `position`. Changing order without changing the set of ids is a real user action and must trigger a write. Sorted-set comparison would incorrectly skip it.

**Data source**: `existing.subcategories` is read from the same `prisma.place.findUnique` call that already existed for ownership/status checks. Added `subcategories: { orderBy: { position: "asc" }, select: { categoryId: true } }` to that select — no extra round-trip.

### When replacement still runs

- Incoming and existing id lists differ in length
- Any position differs (different order)
- Any `categoryId` differs at the same position
- `body.subcategoryIds` is absent → block is skipped entirely (no change, as before)

### Fail-safe

If `existing.subcategories` is empty and `incomingIds` is non-empty, `length` check fails → replacement runs. No silent data loss on fresh places.

## Summary of changes

| Task | Guard before | Guard after | Files changed |
|---|---|---|---|
| A — Event sessions | ✓ fingerprint guard | ✓ unchanged | none |
| B — Event gallery | ✓ equality guard | ✓ unchanged | none |
| C — Place subcategories | ✗ none | ✓ ordered comparison | `src/app/api/business/places/[id]/route.ts` |

## Remaining risks

- Place subcategory comparison is ordered. If a future caller reorders subcategories and the new order happens to match the stored order, the write is correctly skipped. No risk here.
- `activityGalleryMatchesIncomingMediaIds` makes DB reads on every gallery payload (even when unchanged), because it needs to resolve media references to compare URLs. This is a read-cost, not a write-cost. A future optimization could cache resolved references or compare by raw reference string before resolving.
- Event session fingerprint compares only dates and startTime. If a future field (e.g., endTime, duration) needs to drive session rows, `eventSessionScheduleFingerprint` must be updated or replacement will be incorrectly skipped.

## What comes next

- **Phase 6E** — route stop fingerprint short-circuit (`routeStop deleteMany + create` on every save).
