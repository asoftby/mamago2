# Phase 6F-2.1 Fix: Place logoImageId Consistency on Revision Approval

**Date:** 2026-05-19  
**File changed:** `src/server/services/placeRevision.service.ts`  
**Preceded by:** Phase 6F-2 (`docs/audits/place-approval-image-guard-fix.md`)

---

## Problem

`Place.logoImageId` must reference a `PlaceImage.id`.  
`PlaceRevision.logoImageId` may reference either:

- a **`PlaceImage.id`** — when the revision was created from a snapshot and no new images
  were subsequently uploaded
- a **`PlaceRevisionImage.id`** — when the user uploaded a new logo via the wizard temp-media
  path (set in `savePlaceRevisionDraft` / `submitPlaceRevisionForModeration`)

Before this fix, `approvePlaceRevision` applied:

```ts
logoImageId: revision.logoImageId ?? revision.place.logoImageId
```

This stored `revision.logoImageId` — which may be a `PlaceRevisionImage.id` — directly
into `place.logoImageId`. A `PlaceRevisionImage.id` is not a valid `PlaceImage.id`.

Additionally, after a Phase 6F-2 image-replacement run (`deleteMany + createMany`), old
`PlaceImage` rows are destroyed and new ones get fresh generated ids. Even if
`revision.logoImageId` happened to be a valid `PlaceImage.id` (snapshot case), that row
no longer exists after replacement, so `place.logoImageId` pointed to a deleted row.

---

## Id-space diagram

```
getOrCreatePlaceRevision():
  revision.logoImageId = place.logoImageId        ← PlaceImage.id

savePlaceRevisionDraft() / submitRevision() + wizardSessionId:
  revision.logoImageId = newPlaceRevisionImage.id ← PlaceRevisionImage.id

approvePlaceRevision() — THIS FIX:
  place.logoImageId   = approvedLogoImageId       ← always PlaceImage.id
```

---

## Fix: approvedLogoImageId resolution

Image handling (fingerprint comparison + optional replacement) now runs **before**
`place.update` so that the correct `PlaceImage.id` is known before being written.

### Branch A — images unchanged (`placeFingerprint === revisionFingerprint`)

Existing `PlaceImage` rows are preserved. The logo `PlaceImage.id` is found by URL-
matching the LOGO-kind revision image against the current place image set:

```ts
const revLogoImg = revision.images.find(img => img.kind === "LOGO");
if (revLogoImg) {
  const placeLogoImg = revision.place.images.find(
    img => img.kind === "LOGO" && img.url === revLogoImg.url
  );
  approvedLogoImageId = placeLogoImg?.id ?? revision.place.logoImageId; // defensive fallback
} else {
  approvedLogoImageId = null; // revision has no logo — clear it
}
```

The URL match is safe because the fingerprints match, so a LOGO image present in
`revision.images` is guaranteed to have the same URL as the corresponding LOGO in
`revision.place.images`.

The fallback (`revision.place.logoImageId`) is used only if URL matching fails, which
should not happen when fingerprints match but guards against edge cases.

### Branch B — images changed (`placeFingerprint !== revisionFingerprint`)

Old `PlaceImage` rows are deleted. New ones are created. To obtain the new LOGO
`PlaceImage.id` without an extra `findFirst` round-trip inside the transaction, the LOGO
image is created individually with `tx.placeImage.create` (which returns the row), and
gallery images are created in bulk with `tx.placeImage.createMany`:

```ts
const logoRevImg     = revision.images.find(img => img.kind === "LOGO");
const galleryRevImgs = revision.images.filter(img => img.kind !== "LOGO");

let newLogoPlaceImg: { id: string } | null = null;
if (logoRevImg) {
  newLogoPlaceImg = await tx.placeImage.create({ ..., select: { id: true } });
}
if (galleryRevImgs.length > 0) {
  await tx.placeImage.createMany({ data: galleryRevImgs.map(...) });
}
approvedLogoImageId = newLogoPlaceImg?.id ?? null;
```

`approvedLogoImageId` is then passed to `place.update({ logoImageId: approvedLogoImageId })`.

---

## Scenario matrix

| Scenario | imagesChanged | Revision has LOGO | Result |
|----------|:---:|:---:|--------|
| Snapshot revision, text-only changes | false | yes (from snapshot) | Existing `PlaceImage.id` found by URL — set correctly |
| Snapshot revision, no logo in place | false | no | `approvedLogoImageId = null` |
| User uploaded new logo + gallery | true | yes | New `PlaceImage` created; its id used |
| User uploaded gallery only (no logo) | true | no | `approvedLogoImageId = null` — logo cleared |
| User re-uploaded identical images | false | yes (same URL) | Existing `PlaceImage.id` matched by URL |
| User re-uploaded identical images | false | no | `approvedLogoImageId = null` |

---

## Transaction structure

No writes were removed from the transaction or moved outside it. The only structural
change is the order within the transaction:

**Before:**  
opening-hours → `place.update` → image fingerprint → optional `deleteMany+createMany`

**After:**  
opening-hours → image fingerprint → optional image creation → `place.update` → revision/log

All writes remain inside the single `prisma.$transaction`. Atomicity is unchanged.

---

## What was intentionally not changed

| Area | Reason |
|------|--------|
| Opening hours handling | Covered by Phase 6F-3 |
| `placeRevision.update(status=APPROVED)` | Unchanged |
| `moderationLog.create` | Unchanged |
| Notifications / improvementRequest resolve | Unchanged, outside transaction |
| All other scalar fields in `place.update` | Unchanged |
| Response shapes | Unchanged |
| Status machine guards | Unchanged |
| Admin UI | Unchanged |
| Phase 6F-1 revision draft/submit path | Not re-touched |
