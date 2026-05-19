# Phase 6F-2 Fix: Skip Unchanged Approved Place Image Replacement

**Date:** 2026-05-19  
**File changed:** `src/server/services/placeRevision.service.ts`  
**Audit source:** `docs/audits/place-revision-heavy-paths-audit.md`

---

## Problem

In `approvePlaceRevision`, place images were unconditionally replaced on every approval:

```ts
// before — always executed inside $transaction
await tx.placeImage.deleteMany({ where: { placeId: revision.placeId } });
await tx.placeImage.createMany({ data: revision.images.map(...) });
```

This fires even when the business owner submitted a revision that changed only text fields
(title, phone, etc.) while leaving the gallery identical to the published place. A
`deleteMany` + `createMany` with N image rows is unnecessary in that case.

---

## Where the unconditional replacement was

`approvePlaceRevision` → inside `prisma.$transaction` → after `place.update` scalar
application, before `placeRevision.update(APPROVED)`.

File: `src/server/services/placeRevision.service.ts`, function `approvePlaceRevision`.

---

## How current place images are loaded

The existing approval read used `place: true` which loads all Place scalar fields but
**not** the `images` relation. The fix changes this to:

```ts
place: {
  include: {
    images: { orderBy: { sortOrder: "asc" } },
  },
},
```

This adds one join to the already-necessary `place` read — no extra round-trip.
`revision.place.images` is then available as `PlaceImage[]` in the function body.

---

## Fingerprint

The existing `computeRevisionImageFingerprint` helper (added in Phase 6F-1) is reused.
It takes `{ url: string; kind: string; sortOrder: number }[]` which is compatible with
both `PlaceImage` and `PlaceRevisionImage`.

Fields compared: **`url`, `kind`, `sortOrder`**.  
Canonical sort: `(sortOrder asc, kind asc, url asc)`.

```ts
const placeImageFingerprint    = computeRevisionImageFingerprint(revision.place.images);
const revisionImageFingerprint = computeRevisionImageFingerprint(revision.images);
```

---

## When replacement is skipped

`placeImageFingerprint === revisionImageFingerprint`

→ `tx.placeImage.deleteMany` and `tx.placeImage.createMany` are not called.  
→ Existing `PlaceImage` rows are preserved with their current ids.  
→ All other transaction writes proceed unchanged: `place.update` (scalar fields),
  `placeRevision.update(APPROVED)`, `moderationLog.create`.

---

## When replacement intentionally runs

`placeImageFingerprint !== revisionImageFingerprint`

→ Same `deleteMany + createMany` path as before, unchanged.

---

## Transaction atomicity

No transaction writes were moved or split. The fingerprint comparison uses pre-loaded
in-memory data (no additional DB reads inside the transaction). The transaction boundary
is unchanged: all writes still happen inside the single `prisma.$transaction`.

---

## logoImageId consistency

`place.update` always sets `logoImageId: revision.logoImageId ?? revision.place.logoImageId`
regardless of whether image replacement runs. This is unchanged behaviour.

**Pre-existing note (not introduced by this fix):** `revision.logoImageId` is the id of
a `PlaceRevisionImage` row (set when the revision was built from temp media), not a
`PlaceImage` row. After `createMany` creates new `PlaceImage` rows with new generated
ids, `place.logoImageId` ends up pointing to a `PlaceRevisionImage` id rather than the
newly created `PlaceImage` id. This is a pre-existing concern in the codebase, present
before Phase 6F. It is documented here as a **follow-up risk** but is outside the scope
of this PR — fixing it would require either:
- Returning ids from `createMany` (not supported in Prisma), or
- Using individual `create` calls (as done in the revision draft path in Phase 6F-1), or
- A separate `findFirst(kind=LOGO)` read after `createMany`.

When replacement is **skipped** (images unchanged), `place.logoImageId` is still set by
`place.update` to `revision.logoImageId ?? revision.place.logoImageId`. The existing
`PlaceImage` rows are untouched, so their ids are valid. Behaviour is consistent with
the pre-existing approval path.

---

## What was intentionally not changed

| Area | Reason |
|------|--------|
| `place.update` scalar application | All scalar field writes proceed unchanged |
| `placeRevision.update(status=APPROVED)` | Status transition unchanged |
| `moderationLog.create` | Audit trail unchanged, always fires |
| Opening hours delete/create | Covered by Phase 6F-3 |
| Notifications / improvementRequest resolve | Outside transaction, unchanged |
| Admin moderation UI | No change |
| Response shapes | No change |
| Status machine guards | No change |
| Phase 6F-1 revision draft/submit image branch | Already closed, not re-touched |
