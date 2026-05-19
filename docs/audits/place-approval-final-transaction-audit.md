# Phase 6F-4: approvePlaceRevision Final Transaction Audit

**Date:** 2026-05-19  
**File changed:** `src/server/services/placeRevision.service.ts` (one static import added)  
**Preceded by:** Phase 6F-3.1 (`docs/audits/place-opening-hours-exceptions-approval-audit.md`)

---

## DB operations inventory

### Pre-transaction read (always)

```
placeRevision.findUnique({
  include: {
    place: {
      include: {
        images:        { orderBy: sortOrder asc }          ← Phase 6F-2
        openingHours:  { include: { rules + intervals } }  ← Phase 6F-3
      }
    }
    images:       { orderBy: sortOrder asc }
    openingHours: { include: { rules + intervals + exceptions } }
  }
})
```

All data needed for fingerprinting and field application is loaded in a single
pre-transaction read. No repeated reads inside the transaction.

### Inside `$transaction` — conditional operations

| # | Operation | Condition |
|---|-----------|-----------|
| 1 | `openingHours.delete(place.openingHoursId)` | `revision.openingHours` non-null **AND** fingerprint differs **AND** place has existing OH |
| 2 | `openingHours.create(createPayload)` | Same as #1 |
| 3 | `placeImage.deleteMany({ placeId })` | Image fingerprints differ |
| 4 | `placeImage.create(logoRevImg)` | Images changed **AND** revision has a LOGO image |
| 5 | `placeImage.createMany(galleryRevImgs)` | Images changed **AND** gallery non-empty |

### Inside `$transaction` — always-executed operations

| # | Operation | Notes |
|---|-----------|-------|
| 6 | `place.update(~30 scalar fields)` | Single UPDATE statement; always runs |
| 7 | `placeRevision.update(status=APPROVED)` | State transition; mandatory |
| 8 | `moderationLog.create(...)` | Audit trail; mandatory |

### Outside transaction

| Operation | Reason outside |
|-----------|---------------|
| `notifyPlaceUpdateApproved(...)` | Non-blocking; failure must not roll back approval |
| `resolveImprovementRequest(...)` | Non-blocking; failure must not roll back approval |

---

## Findings

### F1 — Dynamic import inside transaction (fixed in this phase) · LOW

Before this phase, the opening-hours branch contained:

```ts
const { mapToCreatePayload } = await import("@/lib/openingHours");
```

A dynamic `await import(...)` inside an interactive Prisma transaction holds the DB
connection open while Node.js resolves the module. Although Node.js caches the module
after the first call (making subsequent calls fast), the `await` is a microtask boundary
that yields to the event loop, unnecessarily extending the transaction window.

**Fix:** `mapToCreatePayload` is now a static import at the top of the file. No circular
dependency — `@/lib/openingHours` imports only from `@/components/openingHours` and
`@prisma/client`, not from this service.

The `resolveImprovementRequest` dynamic import **outside** the transaction is fine — it
is conditional (`revision.improvementRequestId` guard), wrapped in try/catch, and not
holding a DB connection. Left unchanged.

---

### F2 — `place.update` always fires · INFORMATIONAL

`tx.place.update` writes ~30 scalar fields on every approval, even if only one field
changed. This is one Postgres `UPDATE` statement and is not a significant cost.

Skipping it would require diffing every individual field before the transaction and
choosing whether to run `place.update` or not. This adds complexity for negligible gain,
and `place.update` must always run to ensure `openingHoursId` is kept consistent with
whatever happened in the OH block. **No change.**

---

### F3 — `ageTags`, `visitFormats`, `activityTypes` always overwrite · INFORMATIONAL

```ts
ageTags:       revision.ageTags,
visitFormats:  revision.visitFormats,
activityTypes: revision.activityTypes,
```

These three array fields are written from the revision unconditionally (no `??` fallback
to `revision.place.*`). This is intentional: the revision always carries the full
intended array state (copied from the place at snapshot time and potentially changed by
the editor). An empty array from the revision correctly clears the place's tags.
**No change.**

---

### F4 — Fields not tracked by PlaceRevision · INFORMATIONAL

Several `Place` fields are not part of the revision flow and are never written during
approval:

| Field | Reason not in revision |
|-------|----------------------|
| `primaryCategoryId` | Not in `PlaceRevision` model |
| `subcategories` (relation) | No relation on `PlaceRevision` |
| `discoverySignalIds` | Not in `PlaceRevision` model |
| `bookingEnabled`, `bookingPhone`, `bookingNote` | Not in `PlaceRevision` model |
| SEO fields (`seoTitle`, etc.) | Not in `PlaceRevision` model |

Changes to these fields by business owners are not revision-gated and can be edited
directly (draft path) or by admins. This is existing product design, not a bug.

---

### F5 — Transaction duration · INFORMATIONAL (improved by F1)

With all fingerprint guards in place (Phases 6F-2, 6F-3) and the static import fix
(this phase), the minimum-work approval path (no OH change, no image change) executes:

```
place.update        ← 1 UPDATE
placeRevision.update ← 1 UPDATE
moderationLog.create ← 1 INSERT
```

Three statements inside the transaction on a text-only revision approval — a significant
reduction from the original unconstrained path.

---

## Transaction correctness checklist

| Invariant | Status |
|-----------|--------|
| `place.logoImageId` references a `PlaceImage.id` | ✅ Fixed Phase 6F-2.1 |
| Image replacement is atomic (no partial state) | ✅ Fixed Phase 6F-1 |
| Opening hours delete+create is skipped when unchanged | ✅ Fixed Phase 6F-3 |
| No DB reads inside the transaction | ✅ All data pre-loaded |
| `moderationLog.create` always fires | ✅ |
| `placeRevision.update(APPROVED)` always fires | ✅ |
| Notifications outside the transaction | ✅ |
| No id-space violations in scalar field copy | ✅ |

---

## What was intentionally not changed

| Area | Reason |
|------|--------|
| `tx.place.update` always-fire | Acceptable cost; removing requires complex diffing |
| `resolveImprovementRequest` dynamic import | Correctly outside transaction, conditional |
| Opening hours exceptions | No write path exists today (Phase 6F-3.1) |
| All fingerprint guard logic | Already correct from Phase 6F-2 and 6F-3 |
| Status machine | Unchanged |
| Response shapes | Unchanged |
| Admin UI | Unchanged |
