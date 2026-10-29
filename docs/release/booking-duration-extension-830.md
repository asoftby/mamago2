# Booking Core #830 — variable duration and hourly extension

## Source of truth

The pre-existing `OfferBooking.durationMin` is the **minimum/base duration**.
For existing offers, new columns default to `maxExtensionHours=0`,
`extensionHourPriceByn=NULL`, `extensionDiscountPercent=0`; all
existing prices and fixed booking durations remain unchanged.

For eligible `ON_REQUEST_WINDOWS` exclusive-unit offers, businesses can set:

- Maximum 0–8 **additional full hours** beyond the base duration.
- A non-negative BYN price per additional full hour.
- A 0–90% discount applying **only** to the additional-hours subtotal.

The current schedule editor remains the source of `durationMin`, and the
existing **«Услуги и цены»** editor exposes the extension controls. Grouped
classes, recurring/dates sessions, camps and party booking do not gain variable
duration from this change.

## Availability and pricing invariants

- The pure `bookingDuration.ts` policy is used by the public duration
  catalog, public availability, quote POST, and transactional `reserveSlot`.
  Valid values are base + N × 60 minutes, with N within the configured cap.
  Fractional, below-minimum, excessive and unpriced extensions are rejected.
- Every time-window calculation covers the **entire extended duration**,
  including the existing exclusive-unit prep/cleanup and offer buffer.
  Existing manual blocks and confirmed or held allocations block an
  overlapping extension. A partial reservation is never written.
- Business base price + selected add-ons + discounted additional hours
  are calculated in integer kopeks; rounding is performed on the complete
  additional-hours subtotal. A missing base keeps `QUOTE_REQUIRED`.
  The immutable `BookingRequest.bookingPriceSnapshot` records duration,
  hourly rate, discount, extra hours, additional amount and total.
- The already implemented option and idempotency validation also applies
  to the extended booking: two retries with the same intent reuse the
  original order, while changed `endsAt` constitutes a distinct intent.
- Public class overlay displays a duration selector **only when the
  published offer has real configurable choices**. Changing the duration
  refreshes available slots and the server quote. The business must
  explicitly enable this feature; none of the existing offers gain it
  by default.
- Server APIs do not accept client-supplied amounts, discount, resource
  allocation, or arbitrary unvalidated duration.

## Tests / rollout

- Pure tests cover exact one-hour increments, fixed/group/no-rate cases,
  discount arithmetic and unknown totals.
- Slot availability tests cover complete window, manual block in extension
  hour and independently available shorter slots.
- Disposable PostgreSQL integration verifies a two-hour hold and price
  snapshot, later tariff edits do not mutate the historical order, rejection
  of non-configured extensions and atomic rollback if the additional hour
  is manually blocked.
- Safe **additive** migration. Run the deployment migration only as part of
  the consolidated user-initiated DEV release with existing migration and
  backup safeguards. No live database is accessed by this PR.
- Manual DEV QA must cover enabling the extension in the existing business
  wizard, choosing 1 and 2 additional hours in the public booking modal,
  blocked extension hours, group offers (no selector), quote/booking total,
  business calendar and cancellation.

## Out of scope / remaining #830

- Non-hourly increments, complex day/overnight multi-day pricing, hourly
  option-specific surcharges, capacity sharing, generic request-only and
  confirmed-party extension all require separate product/booking contracts.
- No automatic PROD or DEV deployment, no payment charge.
