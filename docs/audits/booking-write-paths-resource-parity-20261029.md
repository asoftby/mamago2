# Booking Core — write-path and availability parity audit (2026-10-29)

Scope: inspected the current GitHub `dev` implementations of the routes and
command services listed below. This is a **code-path audit**, not a claim that
the live DEV or PROD database migration state has been verified. Existing
canonical entities remain `BookingRequest`, `BookingUnit`,
`BookingAllocation`, `OfferSession` and `CalendarBlock`.

| Entry point / event | Status/resource behavior | Result / remaining gate |
| --- | --- | --- |
| `/api/public/offers/[id]/slots` | `getSlots` → `loadSlotSnapshot` → `calculateSlots`; read-only | Offer/group capacity and exclusive-unit allocation included; preview is never a hold |
| `/api/public/offers/[id]/reserve` | `createPublicClassSlotBooking` → `reserveSlot`; transactional NEW/HELD or group-seat hold | Existing exclusion constraint and group session row locks. **Fix**: explicit BookingUnit row lock before final snapshot to serialize against manual `CalendarBlock` |
| `/api/public/bookings` | Legacy `createPublicBooking` creates request/lead; does not use exclusive BookingUnit | Request-only flow must not be presented as guaranteed availability; keep compatibility |
| `/api/business/bookings/[id]` PATCH | `updateBookingStatus` | Shares transactional lifecycle; **fix** expired `holdUntil` confirmation on group seats without allocations |
| `/api/business/bookings/[id]/status` PATCH | Same `updateBookingStatus` | Same 409 on expired hold; no second status service |
| `/api/business/bookings/[id]/outcome` POST | `closePastStandardBooking`: past CONFIRMED → COMPLETED or CANCELLED | **Fix**: NOT_HELD/CANCELLED now releases active allocations in the same transaction; COMPLETED retains history |
| Offer hold expiry | `expireOfferHolds` sets NEW expired and HELD allocation EXPIRED | Uses `holdUntil <= now` and `expiresAt <= now`; business confirmation now checks same boundary |
| Party public preview | `previewPartyOfferAvailability`; reads resource rules, blocks and allocations | **Fix**: only offer owner's BookingUnit mappings can be shown as available |
| Party business reply / auto-confirm | `replyToPartyRequest`, `lockAvailablePartyUnit`, `allocatePartyUnit`; request CAS and unit lock | Exclusive resource double booking handled; per-offer ownership and schedule checked |
| Party manual confirmation | `confirmPartyRequest`; row locks, unit lock, allocation and quote/item write in one transaction | Party stage/availability rechecked; excluded by DB on overlap; add-on without required BookingUnit remains a separate business-rule audit |
| Party parent quote acceptance | `acceptPartyQuote`; QUOTED → AWAITING_RECONFIRM | **Not** resource confirmation; allocation happens only on business confirmation |
| Party expiry / quote resolution | `expirePartyRequests` and quote expiry; close only pre-confirmation requests | No allocations to release in these pre-confirmation stages; CAS prevents late confirmation wins |
| Parent party cancellation | `cancelPartyBeforeConfirmation`; cancellation only before a confirmed item | Confirmed-party cancellation needs separate supported lifecycle; do **not** assume release operation exists |
| Business manual calendar blocks | `/api/business/booking-units/[id]/blocks`; row lock, occupancy check, create MANUAL block | Both standard offers and party confirmation now lock the same BookingUnit row before final check |
| Resource editing | `/api/business/booking-units/[id]` PUT; unit lock and disallow edits with future confirmed or live HELD occupancy | Linked offer ownership verified; no parallel resource table |
| Party Telegram callback | `partyTelegramConfirmAction` → party confirmation | Signed/idempotent callback uses canonical confirmation, not a distinct allocation implementation |
| Party outbox | `partyOutbox` / `NotificationDelivery` | `PartyOutbox.SENT` is processing success, not channel delivery; #865 reconciliation/health already exists |

## Confirmed defects repaired in this PR

1. Group/offer session reservations store a time-limited `BookingRequest.holdUntil`,
   but `updateBookingStatus` previously validated only `BookingAllocation`.
   Groups have **no** resource allocation. An expired NEW request could be
   confirmed and exceed group capacity after another reservation was made.
   We now check the hold inside the locked transaction, and expose 409.
2. `closePastStandardBooking` cancelled past visits without releasing active
   allocations. The cancellation now changes the request and allocations
   atomically.
3. Party public preview was missing the business ownership scope used in
   `lockAvailablePartyUnit`. Cross-tenant linked units could cause false
   AVAILABLE previews; it now restricts units by publishing business.
4. Manual blocks serialized through `BookingUnit FOR UPDATE`, but
   `reserveSlot` did not lock that row. A block and standard booking could
   race; resource booking now acquires the same lock **before** final preview.

## Invariants and tests

- Hold expiry is exclusive: `holdUntil <= now` cannot be confirmed, even
  without an allocation. Legacy request-only leads (null hold) remain supported.
- `REJECTED`/`CANCELLED` release active standard allocations;
  `COMPLETED` preserves the confirmed historical allocation.
- `BookingUnit` reservation, party confirmation, block creation and resource
  editing coordinate on a resource row lock; the PostgreSQL exclusion
  constraint remains the final protection for overlapping allocations.
- PostgreSQL integration tests exercise expired holds, outcome release,
  manual-block collision and the previously existing concurrent offers/group
  booking tests. Pure and route-contract tests cover other boundaries.

## Remaining integration / release gates

- Confirm the real DB exclusion constraint and Prisma migration state on DEV,
  then test with concurrent real actions; passing disposable Postgres CI does
  not establish PROD migration application.
- Only `BookingUnitType.EXCLUSIVE` exists. Shared capacity/multi-resource
  atomic reservation, option/duration pricing snapshots, and unified
  business Services/Pricing editor remain **future #830 work**.
- Standard public `reserveSlot` currently selects one resource; multi-unit
  atomic reservation is not implemented. Never claim a bundle reservation.
- Calendar/Telegram parity and cancellation of already-confirmed PARTY bookings
  require explicit product/API design; do not misuse the pre-confirmation cancel
  endpoint to release a confirmed resource.
- Business calendar and request-only external leads must distinguish
  **requested** from **confirmed** time.
- No new migrations or PROD changes are included. DEV manual QA follows the
  common combined deploy.
