# Phase 6F-3.1: OpeningHoursException Approval Consistency Audit

**Date:** 2026-05-19  
**Scope:** Read-only audit. No runtime code was changed.  
**Preceded by:** Phase 6F-3 (`docs/audits/place-approval-opening-hours-audit.md`)

---

## Summary

`OpeningHoursException` records **cannot be created through any current product UI or API**.
There is no write path for exceptions in the codebase today. Approval dropping them is
therefore harmless in normal product operation.

No code change is needed in this phase.

---

## Audit findings

### 1. No write path exists for OpeningHoursException

Searched all `.ts` / `.tsx` files under `src/` for:
- `prisma.openingHoursException` (Prisma model accessor)  
- `tx.openingHoursException`  
- `exceptions: { create:` in opening-hours payloads

**Result: zero matches.** `OpeningHoursException` rows cannot be created through any
current API endpoint.

### 2. The UI type has no exceptions field

`OpeningHoursData` (`src/components/openingHours/openingHours.types.ts`) is the
client-facing type used by all opening-hours UI components:

```ts
interface OpeningHoursData {
  mode: OpeningHoursMode;
  timezone: string;
  note?: string;
  rules: DayRule[];
  // ← no exceptions field
}
```

`OpeningHoursEditor`, `DayScheduleEditor`, and related components work exclusively
with `OpeningHoursData`. There is no exception-editing UI.

### 3. The write utilities ignore exceptions

`mapToCreatePayload` and `mapToUpdatePayload` (`src/lib/openingHours/openingHoursMapper.ts`)
accept `OpeningHoursData` and produce Prisma payloads. Neither function creates or
updates `OpeningHoursException` rows. Any exception data that might exist on the source
record is structurally invisible to these functions.

### 4. The revision opening-hours endpoint accepts OpeningHoursData

`PUT /api/business/places/[id]/revision/opening-hours` takes `{ revisionId, data: OpeningHoursData | null }`.
Because `OpeningHoursData` has no exceptions field, a PlaceRevision's `OpeningHours`
record **cannot contain exceptions created through the normal revision flow**.

Similarly, `PUT /api/business/places/[id]/opening-hours` (direct write for draft/admin
paths) uses the same `OpeningHoursData` type via `mapToCreatePayload` / `mapToUpdatePayload`.

### 5. Exceptions appear only in read paths

Every reference to `exceptions` in the codebase is an `include` clause on a Prisma
`findUnique` / `findFirst` — purely for reading and returning data. The only place
exceptions are *acted upon* is `openingHours.service.ts`:

```ts
// getTodayIntervals — runtime "is open today?" calculation
const exception = openingHours.exceptions.find(
  (ex) => ex.date === todayDate
);
if (exception) { /* override weekly rule */ }
```

This is a read-only consumer. It does not create exceptions.

### 6. Approval dropping exceptions is harmless today

Since no write path exists, `OpeningHoursException` rows exist in the database only if:
- Inserted directly (manual DB operation)
- Populated by a data import pipeline

Normal product flow — business owner editing their place, submitting a revision,
admin approving — never produces exception rows. Approval dropping them affects zero
records in the current product state.

### 7. Phase 6F-3 fingerprint guard partially mitigates the future risk

Phase 6F-3 added an unchanged guard: if the revision opening hours (mode, timezone,
note, rules) are identical to the place's, the delete+create is skipped entirely.
This means any manually-set exceptions on the place's `OpeningHours` are preserved
whenever the weekly schedule is unchanged — the approval path no longer gratuitously
destroys them.

Exceptions are still dropped if the weekly schedule changes and the approval path
rewrites the `OpeningHours` record. This is a latent risk for a feature not yet surfaced
in the UI.

---

## Affected models

```
OpeningHours
  └── OpeningHoursException[]  (date, isClosed, allDay, note)  onDelete: Cascade
        └── OpeningHoursExceptionInterval[]  (startTime, endTime, sortOrder)  onDelete: Cascade
```

`onDelete: Cascade` on both children means that deleting an `OpeningHours` row atomically
removes all its exceptions and exception intervals. This is correct schema design but
makes exception data fragile in the face of any opening-hours rewrite.

---

## Recommendation

No immediate code change required.

If exception editing is added to the product in a future phase:
1. Add `exceptions` to `OpeningHoursData` (UI type) and the editor component.
2. Update `mapToCreatePayload` / `mapToUpdatePayload` to include exceptions.
3. Update the approval path to copy exceptions from revision to place, or to merge
   them rather than replace-all.
4. Update the opening-hours fingerprint to include exceptions.
5. Add exception write endpoints (business API + revision API).

Until step 1–2 are done, exceptions can only exist via manual DB insertion or import,
and the approval dropping risk is limited to those cases.
