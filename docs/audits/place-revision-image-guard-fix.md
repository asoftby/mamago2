# Phase 6F-1 Fix: Revision Image Unchanged Guard + Atomic Replacement

**Date:** 2026-05-19  
**File changed:** `src/server/services/placeRevision.service.ts`  
**Audit source:** `docs/audits/place-revision-heavy-paths-audit.md`

---

## What was changed

Two functions in `placeRevision.service.ts` were patched:

- `savePlaceRevisionDraft` — the `wizardSessionId` branch
- `submitPlaceRevisionForModeration` — the `wizardSessionId` branch

A private helper `computeRevisionImageFingerprint` was added above both functions.

Nothing else was touched: approval path, opening hours, admin UI, response shapes, status machine, and business wizard UI are all unchanged.

---

## Fingerprint helper

```ts
function computeRevisionImageFingerprint(images: RevisionImageLike[]): string
```

**Fields compared:** `url`, `kind`, `sortOrder`

**Canonical sort order:** `(sortOrder asc, kind asc, url asc)` — ensures comparison is
stable regardless of the order rows were inserted, while preserving user-visible gallery
ordering as the primary key.

**Output:** comma-joined `"sortOrder|kind|url"` strings. Empty array → `""`.

**Input type:** `RevisionImageLike { url: string; kind: string; sortOrder: number }` —
compatible with `PlaceRevisionImage` rows (Prisma result) and with `TempMedia` mapped to
revision-image shape.

---

## When replacement is skipped

In both functions, replacement is skipped when:

```
computeRevisionImageFingerprint(tempMedia mapped to image shape)
  ===
computeRevisionImageFingerprint(current revision.images from DB)
```

Even when skipped, `tempMedia.updateMany({ status: "ATTACHED" })` still fires so that
temp media rows are not left in stale `TEMP` state.

`logoImageId` on the revision is **not changed** on skip — the existing value already
points to the correct row because no images were deleted or recreated.

---

## When replacement runs

When fingerprints differ, replacement runs **atomically** via `prisma.$transaction`:

```
tx.placeRevisionImage.deleteMany({ where: { revisionId } })
Promise.all(tempMedia.map(...tx.placeRevisionImage.create(...)))
tx.placeRevision.update({ logoImageId: newLogoRow.id })   // only if LOGO present
tx.tempMedia.updateMany({ status: "ATTACHED" })
```

This eliminates the pre-existing partial-state risk: if the server crashed between
`deleteMany` and the final `create`, the revision would have been left without any
images. The transaction ensures the replacement is all-or-nothing.

---

## logoImageId consistency

| Case | Behaviour |
|------|-----------|
| Fingerprints match → skip | `logoImageId` unchanged, still valid (row was not deleted) |
| Fingerprints differ, LOGO present in incoming | `logoImageId` set to the new LOGO row's id inside the transaction |
| Fingerprints differ, no LOGO in incoming | `logoImageId` not updated (LOGO was not in the new set) |

Individual `create` calls are used (not `createMany`) so that each row's generated `id`
is available in memory. This lets us find the LOGO row and set `logoImageId` without an
extra DB read. Correctness was prioritised over a `createMany` micro-optimisation.

---

## What became atomic

`submitPlaceRevisionForModeration` previously had the image replacement **outside** any
transaction, while the status transition (`PENDING`) ran in a separate `$transaction`.
Now the image-replacement block is wrapped in its own `$transaction`. The status
transition transaction is unchanged and follows independently — no nesting, no
behavioural change.

`savePlaceRevisionDraft` image replacement is also now transactional (previously it was
bare `await` calls inside a `try/catch` labeled "non-fatal").

---

## What was intentionally not changed

| Area | Reason |
|------|--------|
| `approvePlaceRevision` place image replacement | Covered by Phase 6F-2 |
| Opening hours `mapToUpdatePayload` deleteMany/create | Covered by Phase 6F-3 |
| Response shapes of all endpoints | No change |
| Status machine guards (`DRAFT`/`NEEDS_REVISION`/`PENDING`) | No change |
| `moderationLog.create` in approval path | No change |
| Admin moderation UI | No change |
| Business wizard UI | No change |
| `images/route.ts` single-image POST/DELETE | Already optimal, no change |
