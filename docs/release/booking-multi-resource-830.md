# Booking Core #830 — atomic set of exclusive resources (stage 4 foundation)

This PR extends the **existing** `reserveSlot` transaction and its
`BookingRequest` / `BookingAllocation` records. No new booking engine,
table, migration, public API parameter or pricing model is introduced.

## Compatibility and server-side contract

- Existing `unitId` for one exclusive resource remains supported.
- Existing auto-selection for a single available unit remains unchanged.
- `unitIds?: string[]` is an **internal** server-side selector for an
  explicit bundle requiring *every* exclusive resource. It is not advertised
  in any public endpoint and cannot be mixed with `unitId`.
- Resource selector validation rejects empty, duplicate and oversized
  bundles (maximum 8), and cannot be used on group/session slots.
- Every requested resource must be active, owned by the offer's business,
  linked through `BookingUnitOffer` and available for the **same** slot.
  Availability uses each unit's timezone/schedule/exception, manual blocks,
  existing allocations and individual prep/cleanup buffers.
- The transaction locks `BookingUnit` rows **in deterministic ID order**,
  matching manual blocks and party confirmation. Expired holds are released
  before the final re-check. Any invalid resource aborts the transaction.
- A single `BookingRequest.NEW` is written, and one
  `BookingAllocation.HELD` for **each** required resource, all with the same
  `holdUntil`. If any insert fails (including PostgreSQL `23P01`), the
  entire transaction rolls back; no partial bundle or booking is committed.
- Existing standard business confirmation/rejection/cancellation operates by
  `bookingRequestId` over **all** allocations. Previously merged #937 also
  enforces hold expiration before status confirmation.

## PostgreSQL CI coverage

`src/server/offers/reserveSlot.multiResource.integration.test.ts`:

1. Combined room + equipment hold, separate prep/cleanup and unified TTL.
2. Unavailable required resource causes zero new BookingRequest and allocations.
3. Competing offers choose same bundle in reverse order: exactly one wins,
   the other receives SLOT_UNAVAILABLE, without deadlock or duplicate booking.
4. Mixed/duplicate selectors rejected before DB writes.
5. Unlinked resources cannot be reserved via the bundle.

The test uses only the disposable localhost PostgreSQL supplied by
`classes-reservation-integration.yml` and runs after Prisma migrations.

## Remaining work — not in this PR

- **Option model and server-side pricing**: use existing
  `OfferClassTariff` / `PackageComponent` where possible. Decide which
  options are included, extra cost, stand-alone, minimum duration and
  hourly extension. Persist an immutable price/options snapshot.
- **Public API and UI**: do not accept user-supplied `unitIds` as a
  complete product contract. Derive required resources **server-side**
  from the selected priced offering or bundle and implement idempotency.
- **Business editor**: unify service packages, resources, tariffs and
  duration in one existing wizard step; preserve class, camp and party data.
- **DEV E2E**: verify actual applied exclusion constraint and compare business
  calendar to public availability for bundled reservations. Confirm that
  non-exclusive capacity types are still unsupported; never promise sharing.
- **Telegram**: route confirmations through canonical booking status actions,
  not a second allocation path.

No PROD or DEV deployment is performed by this PR.
