# Session resource rollout

`BookingAllocation` owns physical occupancy. A row has exactly one owner: a
booking request, an offer session or an activity session. Party quote links
remain request-owned. The PostgreSQL exclusion constraint covers all owners
and keeps half-open occupancy intervals. Session foreign keys restrict hard
deletion so deleting a session cannot silently free an active allocation.

## Compatibility

| Existing data | Schema rollout | Activation prerequisite |
| --- | --- | --- |
| Standard or party allocation | Keeps its request, quote and interval | None |
| Materialized offer session | Keeps its identity and participants | Explicit required resources and a resolved group identity |
| Recurring class rule | Keeps its existing schedule | Bounded materialization with resource checks |
| Activity session | Keeps its start and selected-session references | Verified end time and explicit resource assignment |
| Publication-to-resource link | Remains an eligible candidate | Business selects an explicit set for the session |

The schema phase creates no assignments. Apply the migrations in order. The
column change uses a short lock timeout, validation runs separately, and
the two foreign-key lookup indexes are built concurrently. If a concurrent
index build is interrupted, inspect its validity before retrying the migration.

## Read-only inventory

Run after the schema migrations with a read-only role on an authorized database.

```sh
psql -X -v ON_ERROR_STOP=1 -f scripts/ops/audit-session-resources.sql
```

The report covers materialized sessions starting in the next 90 days. It lists
active request counts, group counts, candidate and assigned resource IDs, and
possible overlaps with confirmed party allocations and calendar blocks. It
does not load client contact data or expand recurrence rules. A null conflict
result means the interval or resource is unknown. A false result only rules
out the overlap checked by that column. Review schedule rules, exceptions,
capacity, groups sharing a legacy session, and recurring dates before activation.

## Lifecycle integration

Use the tenant-scoped resource locks from PR #1206. Lock the session before
locking the union of its old and new resources in the shared PostgreSQL
order. Re-read availability under those locks and write the booking,
session and allocation changes in one transaction. Party confirmation and
manual blocks lock resources without acquiring session locks.

Fixed sessions retain their allocation when participants cancel. Cancellation
of the session releases occupancy in the same transaction as the state
change. A failed move rolls back the new interval and retains the old one.
Enable writes only after the schedule editors, confirmation and cancellation
paths honor those invariants. Group identity and event end times are added
with their respective runtime integrations.


## Manual business bookings: shared resource-occupancy contract (2026-11-11)

**Scope:** `/business/bookings` → `+ Новая запись`, `ManualBookingDialog`,
`POST /api/business/bookings/manual`, `createManualBooking`. The **same**
`BookingRequest` is listed in Inbox and the business Calendar. Only records
with an actual date can appear on a calendar date; display does not itself
prove that the corresponding physical resource has been reserved.

### Verified current behavior (dev `9fc45192ee80ecd2029b40aca6067f587280b7d2`)

| Manual booking path | Current write | Resource occupancy |
| --- | --- | --- |
| Scheduled `OFFER` with `offerSlot` | `createManualBooking` → `reserveSlot` | Request-owned `BookingAllocation` for required exclusive units, transactional; currently verified in `reserveSlot.multiResource.integration.test.ts` |
| `EVENT` session | `createPublicationBooking` → `BookingRequest` with `selectedSessionId` | Seat/capacity checked; **no automatic** `ActivitySession`-owned `BookingAllocation` by this path |
| `EVENT` date-only or `REQUEST_ONLY` | `BookingRequest` | No exact resource interval and no physical-resource hold |
| `PLACE` | `BookingRequest`; date/time fields may be optional | No resource choice or atomic `BookingAllocation` by this path |
| Non-scheduled `OFFER` request | `BookingRequest` | No resource interval/hold automatically assigned |

The current schema intentionally supports `BookingAllocation.bookingRequestId`,
`offerSessionId`, and `activitySessionId` as **alternative owners**. The
schema phase did not assign physical resources to existing sessions.
`BookingUnitOffer` is a candidate relationship, **not** an unambiguous
session-level resource assignment. `BookingUnit.placeId` is optional and
cannot infer the correct room or performer.

### Decision: when a booking occupies a resource

1. **Individual appointment** (animator/photographer/room, freely selected
   duration): one `BookingRequest` reserves the explicitly selected
   exclusive `BookingUnit` for the selected full start/end interval, including
   preparation/cleanup. Use the existing `reserveSlot` flow for scheduled
   offers. A future generic path for manual PLACE/other individual services
   must share the **same** locking, interval validation, exception/block checks
   and exclusion constraint; do not implement a second reservation engine.
2. **Fixed group session** (class/event): the `OfferSession` or
   `ActivitySession` owns one physical-resource allocation for the **entire
   session**. Individual participant `BookingRequest` rows consume seats,
   not one exclusive unit each. A second participant may book an available
   seat without attempting a duplicate allocation. Resource assignment
   requires an explicit owner/business-scoped session mapping and validated
   end time before activating writes.
3. **Date-only production order** (decorator/cake): never manufacture an
   exclusive all-day room allocation. Daily order capacity is a separate
   capacity contract, not yet implemented.
4. **Request without an agreed date/time**: creates a request/inbox item
   only, with **no calendar block or claimed physical occupancy**. Show
   "Время и ресурс не зарезервированы" explicitly.
5. **External confirmed booking**, when a corresponding offer is absent:
   support a deliberate manual `CalendarBlock` until a typed resource-backed
   manual booking exists. Do not represent that block as a completed
   `BookingRequest`; no customer data in a calendar block.

### UX contract: compact manual booking

- Enter by `+ Новая запись` in either Inbox or Calendar. Keep one dialog
  and one POST operation; reuse compact form from PR #1228 (if merged).
- First choose an existing publication; show relevant choices only.
  For an individual service, date + start + permitted duration and an
  explicitly selected resource when there is >1 eligible unit. Do not
  require duplicate weekly schedules. Show a *read-only preview* of the
  occupied time including buffers; distinguish appointment length from
  start-time step. Exact durations require server validation and quote.
- For a group event/class, select the existing session and available
  participant tariff/seats. Do not expose a per-participant exclusive
  resource selector. An owner may assign/change the session's resource
  through its session editor once end-time/lifecycle integration is safe.
- If the user manually creates a request-only or date-only booking,
  communicate that resource occupancy is not claimed. Never label
  "Подтверждена" as proof of resource availability unless the selected
  mode has actually reserved it.
- Server remains authoritative for business ownership, publication status,
  capacity, time, price, idempotency and conflicts. Do not trust UI slots.

### Safety and lifecycle invariants

- Reuse `BookingRequest`, `BookingAllocation`, `CalendarBlock`,
  `reserveSlot` and `resourceAllocation.lockBookingUnits`. **No
  parallel booking table or schedule engine.**
- Resource IDs must be explicitly associated with the correct
  business/publication/session, not inferred by matching Place alone.
- For time-based assignments: validate the whole interval and buffers;
  reject out-of-schedule, CLOSED exception, existing CalendarBlock, live
  HELD/CONFIRMED conflict, or invalid cross-business resource.
- Order locks: session owner first where appropriate, then the union
  of resource IDs sorted consistently. Re-read under locks. PostgreSQL's
  active-overlap exclusion remains the final race protection.
- Booking creation and occupancy write commit **atomically** with a
  request idempotency key; an occupancy conflict must not leave a
  successful BookingRequest.
- Request-owned allocations transition with that request's status.
  Group session-owned occupancy survives participant cancellation and is
  released only when that **session** is cancelled; a failed reschedule
  rolls back both the session and its allocation.
- Unlinked resources and legacy manual records must not become
  automatically occupied during rollout. No backfill that guesses owners.
- Availability/read APIs do not expose customer PII. Keep approved
  business tenant guards and separate public listing rules.

### Small-PR sequence (no automatic merge/deploy)

**M0 – Audit + contract:** this document; inspect each status/transfer/
session editor and existing PostgreSQL tests. Keep business behavior intact.

**M1 – Individual appointments:** ensure manual bookings on supported
`ON_REQUEST_WINDOWS` offers continue to run through `reserveSlot`.
Add PostgreSQL tests for two offers sharing one solo worker, manual
confirmation vs another concurrent request, duration/buffers, idempotent
retry, conflict rollback, and CANCELLED/RELEASED status. For PLACE /
non-scheduled offers, add resource-backed manual booking **only after**
there is an explicit full interval and resource selector; otherwise
show a clear non-blocking request state.

**M2 – Fixed group sessions:** materialize the explicit physical-unit
assignment and its complete lifecycle under the **session owner**,
not per participant. Gate writes until group identity, session end time,
cancellation, rescheduling and destructive editor flows are proven.
Cover concurrent attendance, two sessions competing for one room,
participant vs session cancellation and move rollback in PostgreSQL.

**M3 – Cross-type calendar:** read the above owners, request status and
manual blocks from one occupancy model; distinguish booking from block.
Ensure business calendar, session editor and public availability agree.
Business copy must not imply all existing events/classes automatically
reserve a room before M2 is live.

### Acceptance and evidence

Test at least: animator with 3 offers / 1 unit (no overlapping bookings),
fixed class with 10 seats / 1 room (multiple participants share occupancy),
a second class competing for that room, a manual confirmed PLACE booking
with explicit resource and duration, and requests without time (inbox only).
Include cross-business IDOR checks, 30/90-minute duration where allowed,
edge buffers, 24:00/Minsk-local conversions, HELD expiration, manual
block conflict, cancellation/extension/move rollback, and retry key.
Run local disposable PostgreSQL integration tests, typecheck and CI on
exact PR SHA before enabling any new allocation writes.

**Release guard:** until all involved lifecycle operations are audited
and tests pass, leave unimplemented paths as transparent requests
rather than claiming to have reserved a physical resource.
