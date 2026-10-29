# Booking Core — audited state and staged source of truth (#830 / #824)

Date: 2026-10-29. Scope: GitHub `dev` **code** only, no live DB inspection or
schema changes. This is Stage 1 of #830 / outstanding architecture work in #824,
not a claim that the full booking product is ready.

## Existing ownership; do not create a second booking engine

| Concern | Current authoritative path | Important limitation |
| --- | --- | --- |
| Reservation lifecycle and contact snapshots | `BookingRequest` via `booking.service.ts` and `reserveSlot.ts` | Legacy generic requests can be created without a resource hold; request-only must not be advertised as a confirmed slot |
| Exclusive physical resource and cross-offer collisions | `BookingUnit`, `BookingUnitOffer`, `BookingAllocation`, `CalendarBlock` | `BookingUnitType` has only `EXCLUSIVE` in schema; shared/capacity resources are **not** implemented |
| Resource opening hours and overrides | `AvailabilityRule` / `AvailabilityException` attached to `BookingUnit` | Preview for `ON_REQUEST_WINDOWS` only; other offer booking schedules have separate rules |
| Class/group capacity | `OfferClassGroup` + `OfferSession` and active `BookingRequest` seats | Capacity belongs to the session/group path, not the exclusive `BookingAllocation` path |
| Offer schedule and public slot preview | `OfferBooking` + `OfferScheduleRule` / `OfferScheduleException` through `getSlots.ts` → `calculateSlots` | Public preview is advisory; `reserveSlot` must recheck inside transaction |
| Party resource selection | `partyConfirm.service.ts` with `lockAvailablePartyUnit` and `allocatePartyUnit` | Quote/confirmation semantics differ from standard offer hold |
| Manual external blocking | `CalendarBlock` (`MANUAL`, `EXTERNAL`) | Editing/propagation across every channel requires E2E verification |
| Delivery to business | `PartyOutbox` + `NotificationDelivery` / business Telegram | `PartyOutbox.SENT` means *processed*, not *Telegram delivered*; #865 has its own detection/reconciliation changes |

### Verified code-level lifecycle

- `reserveSlot` checks active `Offer`, selected class group/tariff, schedule and resource.
  For an exclusive `ON_REQUEST_WINDOWS` booking it rechecks under a transaction,
  writes `BookingRequest.NEW` and `BookingAllocation.HELD` together, with
  prep/cleanup buffers. Expired HELD rows on the selected unit are marked
  `EXPIRED` in the transaction before insert.
- For group sessions, the same path locks `OfferClassGroup` and
  `OfferSession`, recomputes requested seats and writes the request.
- Business status transition is transactional: `CONFIRMED` converts valid
  HELD allocations to CONFIRMED; `REJECTED`/`CANCELLED` releases them.
  Expired/released allocations cannot be revived by the pure
  `allocationTransition` guard. The result is **not** proof of behavior
  when other status-writing entrypoints bypass this service.
- `getSlots` loads allocations **by BookingUnit**, not only current offer,
  enabling cross-offer conflict visibility for linked exclusive resources.
  `calculateSlots` ignores expired HELD allocations in a preview, and honors
  manual `CalendarBlock` overlaps.
- Party confirmation uses transaction row locks and explicit resource
  allocation; verify its exclusion constraint and status compatibility separately.

### Database race/availability gates for DEV rehearsal

The code handles PostgreSQL exclusion conflicts (`23P01`), but a code
reference to `BookingAllocation_no_active_overlap` does **not** prove the
constraint is installed on the deployed database. Do not promise conflict
safety on DEV/PROD without this read-only check:

```sql
SELECT conname, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.conrelid = '"BookingAllocation"'::regclass
  AND c.contype = 'x';
```

Confirm a single active allocation for the same exclusive resource excludes
overlap, across *different offers*, including prep/cleanup. Verify the
migration record in `_prisma_migrations` and query plan with the deployed DB.
Never add a second competing constraint without comparing the current DDL.

### Staged implementation order

**P0 — before common DEV test**

1. Map every write path that changes BookingRequest or BookingAllocation,
   including expiry, cancel, accept/reject, Party and business webhooks.
   Require status↔allocation consistency from each path; add tests for two
   simultaneous reservations, group capacity, quote confirmation conflicts
   and cancellation while held.
2. Verify active exclusion constraint and run disposable Postgres concurrency
   tests; investigate any bypass before enabling public booking.
3. Confirm that `request-only` never exposes a guaranteed slot and that
   manual/external blocks are visible in offer and party previews.

**P1 — after P0 invariant tests**

4. Add the smallest compatibility adapter that reads resource availability
   from BookingUnit for eligible Offer; do not rewrite OfferBooking schedules.
5. Add multi-resource reservation (all required unit locks and allocations in
   one transaction), server-side duration/options/price snapshot, and request
   idempotency. Introduce pricing data only after a model/contract inventory
   confirms no existing tariff or package table can be reused.
6. Unify the existing business *Services and pricing* editor using current
   class groups/tariffs and booking units. Keep camps and legacy offers intact.

**P2 — integrations**

7. Single business calendar and Telegram state projection for confirmed,
   rejected, cancelled and expired holds. Keep manual and external booking
   paths available; replay and webhook reconciliation must be idempotent.
8. DEV E2E including timezones/DST, capacity, concurrent requests, TTL,
   double booking across offers, public UI vs business calendar. PROD only
   after DEV acceptance.

## New regression coverage in this PR

- Cross-offer occupancy of a shared exclusive unit vs an alternative unit.
- Manual calendar block removes the last available unit.
- HELD TTL expiration exact boundary in slot preview.
- Confirmation of a multi-resource booking fails when **any** hold expired.
- Cancellation releases allocations for the entire request.
- Request-only without an allocation does not create a phantom allocation.

All tests are in-memory/pure; they do **not** replace transactional PostgreSQL
concurrency tests or a real migrations audit. No new resources, APIs or tables
are introduced in this PR.
