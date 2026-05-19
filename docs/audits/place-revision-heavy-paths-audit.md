# Phase 6F Audit: Published Place Revision / Moderation Heavy Paths

**Date:** 2026-05-19  
**Scope:** Read-only audit. No runtime code was changed.  
**Status:** DRAFT — pending Phase 6F-1..6F-4 implementation PRs.

---

## 1. Executive Summary

| # | Finding | Severity |
|---|---------|----------|
| 1 | `savePlaceRevisionDraft` + `wizardSessionId`: N sequential individual `placeRevisionImage.create` calls instead of `createMany`. Unconditional replace-all. | **HIGH** |
| 2 | `submitPlaceRevisionForModeration` + `wizardSessionId`: same pattern — N serial creates in a `for` loop, outside any transaction. Partial-state risk on crash. | **HIGH** |
| 3 | `approvePlaceRevision` — `placeImage.deleteMany + createMany` unconditional on every approval, even when images are identical to the revision snapshot. | **HIGH** |
| 4 | `mapToUpdatePayload` in `openingHoursMapper.ts` — always `deleteMany + create` for all rules/intervals on every PUT, no unchanged guard. Called on every opening-hours save in the revision flow. | **HIGH** |
| 5 | `approvePlaceRevision` opening hours: always `delete + create` full OpeningHours tree (rules → intervals) even if data matches existing place opening hours. | **MEDIUM** |
| 6 | `submitPlaceRevisionForModeration` image block is outside a Prisma transaction — a crash between `deleteMany` and the last `create` leaves revision without images. | **MEDIUM** |
| 7 | `savePlaceRevisionDraft` with temp media: two extra `placeRevision.update` round-trips (one for data fields, one for `logoImageId`) where one would do. | **LOW** |
| 8 | Opening-hours update flow loads `revision.openingHours` with full `rules → intervals → exceptions → exception intervals` even when about to delete-all-and-recreate anyway. | **LOW** |
| 9 | `images/route.ts` POST for LOGO: targeted `deleteMany({ kind: "LOGO" }) + single create` — already optimal, no action needed. | **INFORMATIONAL** |
| 10 | `requestPlaceRevisionChanges` / `rejectPlaceRevision`: minimal DB work, use transaction array correctly. Safe as-is. | **INFORMATIONAL** |

---

## 2. Flow Map

| Flow | Endpoint / Service | Trigger | Current DB work | Replace-all ops | Frequency | Risk | Optimization candidate |
|------|--------------------|---------|-----------------|-----------------|-----------|------|------------------------|
| Get or create revision snapshot | `getOrCreatePlaceRevision` | Wizard GET on published place | `place.findUnique(+images)`, `placeRevision.create` (nested image creates) | Nested create per snapshot image | Once per revision lifecycle | Low — runs once | No |
| Draft save (scalar fields only) | `PATCH /revision` → `savePlaceRevisionDraft` (no wizardSessionId) | Wizard manual save | `placeRevision.update` | None | Per wizard step | Negligible | No |
| Draft save with temp media | `PATCH /revision` → `savePlaceRevisionDraft` (with wizardSessionId) | Wizard media upload step | `tempMedia.findMany`, `placeRevisionImage.deleteMany`, N×`placeRevisionImage.create`, `placeRevision.update` (logoImageId), `tempMedia.updateMany`, revision reload | deleteMany + N individual creates | Per upload batch | **High** | **Yes — Phase 6F-1** |
| Submit revision | `POST /revision/submit` → `submitPlaceRevisionForModeration` | Wizard submit button | `placeRevision.findUnique`, `improvementRequest.findFirst`, `tempMedia.findMany`, `placeRevisionImage.deleteMany`, N×`placeRevisionImage.create` (loop), `placeRevisionImage.findFirst`, optional `placeRevision.update`, `tempMedia.updateMany`, `$transaction([placeRevision.update, improvementRequest.update])` | deleteMany + N serial creates (outside tx) | Once per submission | **High** | **Yes — Phase 6F-1 + atomicity fix** |
| Update revision opening hours | `PUT /revision/opening-hours` | Wizard opening-hours step | `placeRevision.findUnique(+openingHours full tree)`, `openingHours.update(deleteMany rules + create)` | deleteMany rules + N interval creates | Per opening-hours save | **High** | **Yes — Phase 6F-3** |
| Add single revision image | `POST /revision/images` | Image upload click | `placeRevisionImage.deleteMany({ kind: LOGO })` (LOGO only), `placeRevisionImage.create`, `placeRevision.update` (logoImageId), `placeRevisionImage.findMany` | Targeted LOGO-only delete | Per image upload | Low | No |
| Delete single revision image | `DELETE /revision/images` | Image delete click | `placeRevisionImage.delete`, optional `placeRevision.update` (clear logoImageId), `placeRevisionImage.findMany` | None | Per image delete | Low | No |
| Approve revision | `POST /admin/moderation/.../revision` → `approvePlaceRevision` | Admin/moderator approval | `placeRevision.findUnique(+images+openingHours full tree)`, optional `openingHours.delete + openingHours.create`, `place.update` (all scalars), `placeImage.deleteMany`, `placeImage.createMany`, `placeRevision.update`, `moderationLog.create`, (outside tx) notification + improvementRequest resolve | deleteMany + createMany for place images; delete + create for openingHours | Once per approval | **High** | **Yes — Phase 6F-2, 6F-3** |
| Request revision changes | `POST /admin/moderation/.../revision` → `requestPlaceRevisionChanges` | Moderator sends back | `placeRevision.findUnique`, `$transaction([placeRevision.update, moderationLog.create])`, (outside tx) `place.findUnique`, notification | None | Low | Low | No |
| Reject revision | `POST /admin/moderation/.../revision` → `rejectPlaceRevision` | Moderator reject | Same pattern as request-changes | None | Low | Low | No |

---

## 3. Revision Draft Save

### What happens on manual save

1. Client sends `PATCH /api/business/places/[id]/revision` with `{ revisionId, data }`.
2. `savePlaceRevisionDraft` reads revision + place ownership fields (1 read).
3. Strips fields that don't belong in `PlaceRevision` (logoMediaId, galleryMediaIds, images, etc.).
4. `placeRevision.update` with remaining scalar fields (1 write).
5. **If `wizardSessionId` is present** (temp media path):
   - `tempMedia.findMany` (1 read, ~1–15 rows)
   - `placeRevisionImage.deleteMany` — unconditional, deletes all existing revision images
   - `Promise.all(tempMedia.map(...placeRevisionImage.create))` — N **individual** creates (not `createMany`)
   - If a LOGO is found: extra `placeRevision.update` to set `logoImageId`
   - `tempMedia.updateMany` to mark as ATTACHED
   - `placeRevision.findUnique` reload with images

### Autosave behavior

Autosave **does not** use the revision flow for published places. In `PlaceWizard`:
- `handleAutoSave` calls `PATCH /api/business/places/[id]` (direct place update)
- The API rejects this for published places with `PUBLISHED_PLACE_REQUIRES_REVISION` (400)
- Autosave effectively becomes a no-op for published places — only explicit "Save" button triggers the revision path

So the heavy draft-save path fires on manual "Save", not on every keystroke. Frequency is moderate (once per wizard step change), but still deserves an unchanged guard.

### Image/opening-hours writes on draft save

- Images are written only when `wizardSessionId` is provided (media upload step)
- Opening hours are written via a separate `PUT /revision/opening-hours` endpoint, not via `savePlaceRevisionDraft`
- The draft-save itself does not touch `placeRevisionImage` unless temp media is present

---

## 4. Revision Images

### Where deleteMany / createMany occurs

**Location 1 — `savePlaceRevisionDraft` (service line ~318–338):**
```
placeRevisionImage.deleteMany({ where: { revisionId } })
Promise.all(tempMedia.map(media => placeRevisionImage.create({ data: ... })))
```
All existing revision images are deleted and replaced with whatever temp media exists for the session. The guard is only `tempMedia.length > 0` — no comparison against current images.

**Location 2 — `submitPlaceRevisionForModeration` (service line ~455–486):**
```
placeRevisionImage.deleteMany({ where: { revisionId } })
for (const media of tempMedia) {
  await placeRevisionImage.create({ data: ... })  // sequential, not Promise.all
}
```
Identical semantic to Location 1, but images are created **sequentially** in a `for` loop (even slower than Location 1's `Promise.all`). Also entirely outside any transaction.

**Location 3 — `approvePlaceRevision` (service line ~673–688, inside transaction):**
```
tx.placeImage.deleteMany({ where: { placeId: revision.placeId } })
tx.placeImage.createMany({ data: revision.images.map(...) })
```
Replaces all `PlaceImage` for the Place with copies from `PlaceRevisionImage`. No unchanged guard.

### Fields to compare for fingerprinting

For Locations 1 & 2 (`PlaceRevisionImage` replacement), compare sorted arrays of:
```
{ url, kind, sortOrder }
```
A canonical fingerprint is `JSON.stringify(images.map(i => `${i.kind}|${i.url}|${i.sortOrder}`).sort())`.

For Location 3 (approval `PlaceImage` replacement), compare the same fields from `revision.images` vs existing `place.images` (already loaded in the revision read at approval time, since `include: { place: true }`; but `place.images` is NOT included in the approval read — see Safety Rules below).

### Can we fingerprint?

**Locations 1 & 2:** Yes. Read current `placeRevisionImage` before delete, compare fingerprints. Skip delete+create if identical. Safe, because we control both sides.

**Location 3:** Yes, with a prefetch. The approval read already loads `revision.images` but does NOT load `place.images`. Adding `place: { include: { images: true } }` to the approval read (already reads `place: true`) enables fingerprinting before the deleteMany. This adds 1 extra join but saves N deletes + N creates when images are unchanged.

### Order important?

Yes. `sortOrder` is user-visible (gallery ordering). Fingerprint must include `sortOrder` and must compare arrays in a canonical sorted order (e.g. by `sortOrder` then `url`), not arbitrary order.

---

## 5. Opening Hours

### Where they are copied / recreated

**Draft edit path — `PUT /revision/opening-hours`:**
- If `revision.openingHoursId` exists: calls `mapToUpdatePayload(data)` → `openingHours.update` with `rules: { deleteMany: {}, create: [...] }`. Always wipes and recreates all rules and intervals, even if the data is byte-for-byte identical to what was there.
- If no `revision.openingHoursId`: calls `mapToCreatePayload(data)` → `openingHours.create`. Only fires once per revision.

**Approval path — `approvePlaceRevision`:**
- If `revision.openingHours` is present: `openingHours.delete(place.openingHoursId)` (cascade deletes rules + intervals) + `openingHours.create(mapToCreatePayload(...))`. Unconditional.
- The full OpeningHours tree is loaded for approval read: `openingHours → rules → intervals + exceptions → exception intervals`.

### Entities created on an opening-hours write

```
OpeningHours (1)
  └── OpeningHoursRule (up to 7, one per open day)
        └── OpeningHoursInterval (typically 1–2 per rule)
OpeningHoursException (0–N, separate model, not touched by WEEKLY saves)
```
A typical weekly schedule creates 1 + 5×1 = 6 rows minimum; 1 + 7×2 = 15 rows maximum.

### Can we skip unchanged?

**Draft edit path:** Yes. Before calling `mapToUpdatePayload`, serialize the incoming `OpeningHoursData` and compare with a serialization of `revision.openingHours` (already loaded in the PUT handler). Skip the update if identical. The comparison must normalize rule ordering (sort by `dayOfWeek`) and interval ordering (sort by `sortOrder`).

**Approval path:** Yes, but requires also loading `place.openingHours` (not loaded today). Comparing `revision.openingHours` fingerprint vs `place.openingHours` fingerprint before delete+create is safe if the fingerprint covers: `mode`, `timezone`, `note`, and sorted rules+intervals. If identical, skip the openingHours delete+create and keep `newOpeningHoursId = revision.place.openingHoursId`.

### Where to leave unchanged

- `OpeningHoursException` logic is complex and low-frequency. Do not attempt to fingerprint exceptions in Phase 6F-3 — only fingerprint `mode + timezone + note + rules`.
- Do not modify the `mapToUpdatePayload` function itself (shared with other entity types) — add the guard at the call site in the route handler.

---

## 6. Approval Path

### `approvePlaceRevision` — full breakdown

```
Read: placeRevision.findUnique({
  include: {
    place: true,                              // full Place scalars
    images: { orderBy: sortOrder asc },      // PlaceRevisionImage[]
    openingHours: {                           // full tree
      rules: { intervals },
      exceptions: { intervals }
    }
  }
})

$transaction:
  if revision.openingHours:
    openingHours.delete(place.openingHoursId)   // cascade deletes rules + intervals
    openingHours.create(mapToCreatePayload())    // N rules × M intervals
  place.update(ALL ~30 scalar fields)            // always fires
  placeImage.deleteMany({ placeId })             // unconditional
  placeImage.createMany(revision.images)         // unconditional
  placeRevision.update(status=APPROVED)          // always fires
  moderationLog.create()                         // always fires, must always fire

Outside transaction:
  notifyPlaceUpdateApproved(...)                 // non-blocking, try/catch
  resolveImprovementRequest(...)                 // non-blocking, try/catch
```

### What can be optimized

| Operation | Optimization | Risk |
|-----------|-------------|------|
| `placeImage.deleteMany + createMany` | Add fingerprint guard — load `place.images` at approval read, compare vs `revision.images`. Skip if identical. | Low. Images are snapshotted at revision creation; no concurrent modification during PENDING state. |
| `openingHours.delete + create` | Add fingerprint guard — load `place.openingHours` at approval read, compare fingerprint. Skip if identical. | Low. Same reasoning. |
| `place.update(ALL ~30 scalars)` | Cannot skip — revision may change any field, and Prisma `update` is a single UPDATE statement regardless of how many fields. No savings from partial update here. | N/A |

### What must NOT be optimized

| Operation | Reason |
|-----------|--------|
| `moderationLog.create` | Audit trail — mandatory, no skip. |
| `placeRevision.update(status=APPROVED)` | State machine transition — mandatory. |
| Full transaction atomicity | Approval must be all-or-nothing. Never move any of these writes outside the transaction. |
| Notification and improvementRequest resolve | Already outside tx, already wrapped in try/catch. Pattern is correct. Do not move them inside the tx. |

---

## 7. Suggested Safe PR Plan

### Phase 6F-1: Revision image unchanged guard

**Scope:** `placeRevision.service.ts` — `savePlaceRevisionDraft` and `submitPlaceRevisionForModeration`.

**Changes:**
1. In `savePlaceRevisionDraft` (wizardSessionId branch): before `deleteMany`, load current `placeRevisionImage` rows. Compute fingerprint of current images vs incoming tempMedia. Skip deleteMany+createMany if identical.
2. In `submitPlaceRevisionForModeration` (wizardSessionId branch): same guard.
3. Also in `submitPlaceRevisionForModeration`: replace the `for` loop with `createMany` (already in `@prisma/client`). Wrap the `deleteMany + createMany + logoImageId update + tempMedia.updateMany` in a nested `$transaction` inside the existing function to fix the atomicity gap.

**Files:** `src/server/services/placeRevision.service.ts`  
**Risk:** Low. Fingerprint only skips write when incoming data exactly matches stored data.

---

### Phase 6F-2: Approved place image unchanged guard

**Scope:** `placeRevision.service.ts` — `approvePlaceRevision`.

**Changes:**
1. Add `place: { include: { images: { orderBy: { sortOrder: "asc" } } } }` to the approval read (currently reads `place: true` which includes scalars but not the images relation).
2. Compute fingerprint of `place.images` vs `revision.images` (fields: `url`, `kind`, `sortOrder`).
3. Skip `placeImage.deleteMany + createMany` inside the transaction if fingerprints match.

**Files:** `src/server/services/placeRevision.service.ts`  
**Risk:** Low. The transaction structure remains unchanged; only the two image-write statements are conditionally skipped.

---

### Phase 6F-3: Opening-hours fingerprint audit / fix

**Scope:** Two locations.

**Changes:**
1. `PUT /revision/opening-hours` route: before calling `mapToUpdatePayload`, serialize incoming `data` and `revision.openingHours` to a normalized fingerprint (mode + timezone + note + sorted rules + sorted intervals per rule). If identical, return `{ success: true, openingHours: revision.openingHours }` without any DB write.
2. `approvePlaceRevision`: add `openingHours: { include: { rules: { include: { intervals: true } } } }` to `place` in the approval read (note: exceptions not included). Fingerprint `revision.openingHours` vs `place.openingHours`. If identical, skip `openingHours.delete + openingHours.create` and keep `newOpeningHoursId = revision.place.openingHoursId`.

**Files:**
- `src/app/api/business/places/[id]/revision/opening-hours/route.ts`
- `src/server/services/placeRevision.service.ts`

**Risk:** Low-medium. Fingerprint must be carefully normalized. Do NOT fingerprint exceptions in this phase.

---

### Phase 6F-4: Consolidate logoImageId update (minor cleanup)

**Scope:** `savePlaceRevisionDraft` wizardSessionId branch.

**Changes:**
Currently two separate `placeRevision.update` calls fire: one for scalar fields (line ~286) and one for `logoImageId` (line ~344). If temp media is present, the second update can be folded into the first by deferring `logoImageId` resolution. However, because `logoImageId` depends on the result of image creation, this requires restructuring the flow slightly.

This is a minor optimization (saves 1 round-trip per media-upload save). Defer to a later PR after Phase 6F-1 is merged and the flow is better understood.

**Risk:** Low. Can be skipped if the team decides the effort is not worth 1 DB round-trip.

---

## 8. Safety Rules

### Must not change without tests

| Area | Rule |
|------|------|
| Approval transaction | All writes inside `$transaction` must remain atomic. Never remove any write from the transaction or move notification/improvementRequest resolve inside it. |
| `logoImageId` consistency | After any image replacement (delete+create), `placeRevision.logoImageId` or `place.logoImageId` must be updated to point to the new row id. A fingerprint skip is only safe if both the images AND the logoImageId are unchanged. |
| Revision status machine | Only `DRAFT` and `NEEDS_REVISION` can be edited. `PENDING` is frozen for moderation. `APPROVED` and `REJECTED` are terminal. Never skip the status check. |
| `moderationLog.create` | Must always fire on APPROVE / NEEDS_REVISION / REJECT actions. No optimization can skip it. |
| One-active-revision invariant | `getOrCreatePlaceRevision` enforces one active revision per place. Do not cache its result between requests. |

### Strong consistency required — do not weaken

| Area | Reason |
|------|--------|
| Approval transaction atomicity | If place.update succeeds but placeImage replacement fails, Place is in a corrupted state (scalar data from revision, images from old version). Must be atomic. |
| Submit → PENDING status transition | `placeRevision.update(status=PENDING)` + `improvementRequest.update(status=IN_PROGRESS)` are in a `$transaction`. Must remain so. |
| Opening-hours reference integrity | `openingHoursId` on Place and PlaceRevision must always point to an existing OpeningHours row. Never null-set during approval without deleting the old row. |

### Fingerprint skip is safe only when

1. The fingerprint covers ALL user-visible fields (url, kind, sortOrder for images; mode, timezone, note, dayOfWeek, isOpen, allDay, startTime, endTime for opening hours).
2. The comparison is done on the pre-existing DB state, not on cached/stale data.
3. `logoImageId` is also verified: if the LOGO image url matches, the existing `logoImageId` still points to the correct row in the new image set (only safe if skip means "nothing was deleted").
4. For opening hours: exceptions are NOT included in the fingerprint in Phase 6F-3. A separate exception-handling audit is required before fingerprinting the full opening-hours tree.

### Do not touch in this phase

- `requestPlaceRevisionChanges` and `rejectPlaceRevision` — already minimal, correct, well-structured.
- `mapToUpdatePayload` / `mapToCreatePayload` in `openingHoursMapper.ts` — shared utility, do not modify. Add guards at call sites instead.
- Admin/moderator UI (`PlaceRevisionModerationView.tsx`) — pure read/display, no DB writes.
- Response shapes of any endpoint — client code depends on them.
- `getOrCreatePlaceRevision` — runs once per revision lifecycle, cost is acceptable.

---

## Appendix: File Reference

| File | Role |
|------|------|
| [`src/server/services/placeRevision.service.ts`](../../src/server/services/placeRevision.service.ts) | All revision business logic — create/save/submit/approve/reject |
| [`src/app/api/business/places/[id]/revision/route.ts`](../../src/app/api/business/places/[id]/revision/route.ts) | GET (get-or-create) + PATCH (save draft) |
| [`src/app/api/business/places/[id]/revision/images/route.ts`](../../src/app/api/business/places/[id]/revision/images/route.ts) | POST (add image) + DELETE (remove image) |
| [`src/app/api/business/places/[id]/revision/opening-hours/route.ts`](../../src/app/api/business/places/[id]/revision/opening-hours/route.ts) | PUT opening hours for revision |
| [`src/app/api/business/places/[id]/revision/submit/route.ts`](../../src/app/api/business/places/[id]/revision/submit/route.ts) | POST submit for moderation |
| [`src/app/api/admin/moderation/places/[id]/revision/route.ts`](../../src/app/api/admin/moderation/places/[id]/revision/route.ts) | POST approve/reject/request-changes |
| [`src/app/api/business/places/[id]/route.ts`](../../src/app/api/business/places/[id]/route.ts) | PATCH (direct place save, blocks published non-admin) |
| [`src/lib/openingHours/openingHoursMapper.ts`](../../src/lib/openingHours/openingHoursMapper.ts) | `mapToCreatePayload` / `mapToUpdatePayload` — always-replace strategy |
| [`src/components/business/wizard/place/PlaceWizard.tsx`](../../src/components/business/wizard/place/PlaceWizard.tsx) | Wizard + autosave (autosave is DRAFT-only; published uses manual save via revision) |
