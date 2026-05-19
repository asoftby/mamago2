# Phase 6F-3: Place Approval Opening Hours Audit & Fix

**Date:** 2026-05-19  
**File changed:** `src/server/services/placeRevision.service.ts`  
**Preceded by:** Phase 6F-2.1 (`docs/audits/place-logo-image-id-consistency-fix.md`)

---

## Models involved

```
OpeningHours          (id, mode, timezone, note)
  └── OpeningHoursRule[]          (dayOfWeek, isOpen, allDay)  onDelete: Cascade
        └── OpeningHoursInterval[] (startTime, endTime, sortOrder)  onDelete: Cascade
  └── OpeningHoursException[]     (date, isClosed, allDay, note)  onDelete: Cascade
        └── OpeningHoursExceptionInterval[]  (startTime, endTime)  onDelete: Cascade

Place.openingHoursId → OpeningHours.id
PlaceRevision.openingHoursId → OpeningHours.id  (@relation "PlaceRevisionOpeningHours")
```

`Place` and `PlaceRevision` each hold their own separate `OpeningHours` row. They are
never shared — the revision owns its own row, the place owns its own row.

---

## Pre-fix behavior in `approvePlaceRevision`

```ts
let newOpeningHoursId = revision.place.openingHoursId;

if (revision.openingHours) {
  // Always runs — no unchanged guard
  const createPayload = mapToCreatePayload(...);

  if (revision.place.openingHoursId) {
    await tx.openingHours.delete({ where: { id: revision.place.openingHoursId } });
    // ↳ cascades: deletes all OpeningHoursRule + OpeningHoursInterval for that record
  }

  const newOpeningHours = await tx.openingHours.create({ data: createPayload });
  newOpeningHoursId = newOpeningHours.id;
}
```

**What gets deleted:** the existing `OpeningHours` row for the place, plus all its
`OpeningHoursRule` rows (cascade), plus all `OpeningHoursInterval` rows (cascade).
`OpeningHoursException` rows are also cascade-deleted.

**What gets recreated:** a new `OpeningHours` row for the place with new rules and
intervals, built by `mapToCreatePayload` from the revision data.

**When it fires:** unconditionally whenever `revision.openingHours` is non-null, even
if the revision opening hours are byte-for-byte identical to the current place opening
hours.

---

## Key findings

### 1. Unconditional rewrite on every approval — HIGH (fixed)

Any approval of a revision that includes opening hours triggers a full
delete+recreate of `OpeningHours + rules + intervals`, regardless of whether the
schedule changed. A revision created for a text-only update (e.g. phone number change)
still carries a copy of the opening hours — the business owner may not have touched
them at all — and approval rewrites them unnecessarily.

Typical row count for a WEEKLY schedule: 1 `OpeningHours` + up to 7 `OpeningHoursRule`
+ ~7–14 `OpeningHoursInterval` = 15–22 rows deleted and recreated per approval.

**Fix:** fingerprint guard — skip delete+recreate when the revision and place opening
hours are identical (see §Fix section below).

### 2. Exceptions are silently dropped — MEDIUM (pre-existing, documented)

The revision read includes:
```ts
openingHours: {
  include: {
    rules: { include: { intervals: { orderBy: { sortOrder: "asc" } } } },
    exceptions: { include: { intervals: { orderBy: { sortOrder: "asc" } } } },
  }
}
```

But `mapToCreatePayload` only creates `OpeningHoursRule` rows — it has no exceptions
path. So any `OpeningHoursException` rows on the revision are loaded but never written
to the approved place record.

This is pre-existing behaviour, present before Phase 6F. The opening-hours editor in
the revision wizard may or may not expose exception editing (out of scope to verify
here). Exceptions are excluded from the fingerprint intentionally — they cannot affect
whether the main schedule is rewritten.

**Status:** documented as follow-up risk, not changed in this phase.

### 3. Null revision opening hours — correctly handled (no change)

If `revision.openingHours` is null, the entire block is skipped and
`newOpeningHoursId` stays as `revision.place.openingHoursId`. The place keeps its
existing opening hours. This is correct and unchanged.

### 4. Place has no opening hours + revision does — correctly handled (no change)

The `if (revision.place.openingHoursId)` guard prevents a `delete` call when the
place has no existing opening hours record. A new one is created from revision.
This is correct and unchanged.

### 5. Null/empty states

| State | Behaviour |
|-------|-----------|
| `revision.openingHours = null` | Skip block entirely, keep place OH unchanged |
| `revision.openingHours` non-null, same as place | Skip delete+create (new) |
| `revision.openingHours` non-null, different | Delete old + create new (unchanged) |
| `revision.place.openingHoursId = null`, revision has OH | No delete, just create new |

---

## Fix

### Helper: `computeOpeningHoursFingerprint`

```ts
function computeOpeningHoursFingerprint(oh: OpeningHoursLike | null): string
```

**Fields compared:** `mode`, `timezone`, `note`, and for each `isOpen=true` rule
(sorted by `dayOfWeek`): `allDay`, and if not `allDay` the sorted intervals
(`startTime~endTime`).

**Exceptions excluded** intentionally (see finding 2).

**`isOpen=false` rules excluded:** `mapToCreatePayload` never writes them; the DB
stores only `isOpen=true` rules. Filtering here keeps both sides comparable.

### Load change

`revision.place.openingHours` is now loaded in the approval read:

```ts
place: {
  include: {
    images: { orderBy: { sortOrder: "asc" } },   // Phase 6F-2
    openingHours: {                              // Phase 6F-3 (new)
      include: {
        rules: { include: { intervals: { orderBy: { sortOrder: "asc" } } } },
      },
    },
  },
},
```

One additional join on the existing `place` read — no extra round-trip.
Exceptions not included here (not needed for fingerprint).

### Guard

```ts
const revisionOhFingerprint = computeOpeningHoursFingerprint(revision.openingHours);
const placeOhFingerprint    = computeOpeningHoursFingerprint(revision.place.openingHours ?? null);

if (revisionOhFingerprint !== placeOhFingerprint) {
  // delete old + create new (unchanged path)
}
// else: skip — keep existing place.openingHoursId
```

Comparison is in-memory only. No additional DB reads inside the transaction.

---

## Transaction structure

No writes removed or moved outside the transaction. The opening-hours block remains at
the top of the transaction, before image handling and `place.update`. Structure
unchanged except the inner conditional is now guarded.

---

## What was intentionally not changed

| Area | Reason |
|------|--------|
| Exception copy-on-approval | Pre-existing behaviour, separate audit needed |
| `mapToCreatePayload` function | Shared utility, not modified |
| Image handling (Phase 6F-2 / 6F-2.1) | Not re-touched |
| `place.update` scalar fields | Unchanged |
| `placeRevision.update(APPROVED)` | Unchanged |
| `moderationLog.create` | Unchanged |
| Notifications / improvementRequest resolve | Unchanged |
| Response shapes | Unchanged |
| Status machine | Unchanged |
