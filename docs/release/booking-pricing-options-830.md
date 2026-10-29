# #830 — Booking pricing and add-on snapshot (backend stage)

## Source of truth and compatibility

- Existing `OfferClassGroup / OfferClassTariff` stay the authoritative source
  of class/group tariff choice and tariff titles/prices.
- Existing `PackageComponent` stays the party package composition source;
  this PR does **not** rewrite `PartyQuote`, `PartyOrderItem.offerPriceSnapshot`,
  or birthday confirmation.
- `OfferBooking.basePriceByn` is the fixed booking-level price for scheduling
  offers without a selected class tariff.
- New `OfferBookingOption` represents inclusive (free), optional priced,
  or standalone *catalogue* extras belonging to an existing `OfferBooking`.
  A STANDALONE entry is never sold through the parent reservation; sell it
  using its own Offer. Optional extras cannot be reserved without the main
  booking.
- `bookingUnitId` on an option references an additional *exclusive* resource.
  The public caller supplies option IDs, **never** resource IDs or prices.
  The existing `reserveSlot` transaction derives additional required units
  and holds them with the main unit via the atomic multi-resource engine #940.
  Group options requiring separate BookingUnit are rejected until capacity
  reservation is supported.
- BookingRequest receives `bookingPriceSnapshot` and `bookingTotalByn`.
  `bookingTotalByn = NULL` means an unpriced/request-only quote, not zero.
  Existing historical booking requests remain NULL; no fake backfill.

## Server calculation rules

1. Receive IDs of selected optional extras. INCLUDED extras are selected
   automatically; inactive, unknown, STANDALONE and duplicate selections fail.
2. For class/group bookings, selected active `OfferClassTariff` overrides
   `OfferBooking.basePriceByn`. Legacy `Offer.priceItems` tariff is used
   only when no structured class tariff exists, just as before.
3. Prices are parsed strictly as BYN, calculated using integer kopeks, and
   snapped inside the booking transaction. No client-supplied amounts.
4. Unspecified/non-numeric base price yields `QUOTE_REQUIRED` and NULL total.
   A multi-seat class package whose tariff unit does not explicitly state
   per-seat semantics also yields `QUOTE_REQUIRED` instead of multiplying a
   monthly/visits tariff by seats incorrectly.
5. Fixed-priced reservation total = base + selected optional extras.
   Every snapshot includes source tariff, title, selected options, amount,
   duration and seats. Total is a decimal for querying; snapshot survives
   future tariff and option edits.
6. `POST /api/public/offers/[id]/price-quote` recalculates from the server,
   but never reserves capacity. It does not expose internal resource IDs
   or guarantee that a particular requested time remains free.
7. Existing class reservation `POST .../reserve` accepts only
   `selectedOptionIds[]`; the server rechecks it inside `reserveSlot`.

## Rollout safety

- Additive Prisma migration: new table, enum and optional columns. No
  destructive rewrite, no renaming, no DB/volume recreate.
- Run `prisma migrate deploy` with verified backup and DB guards from
  #280/#281 at the consolidated DEV deployment, not automatically.
- Regression gates: strict pricing parser tests in main CI; PostgreSQL
  multi-resource tests for transactional paid options and immutable snapshot;
  check existing group/camp/party tests unchanged.
- This is **not** a payment transaction or an invoice. Currency BYN only.
  Money cannot be changed by clients after reservation.
- Current booking UI does not yet expose the option picker or a B2B price
  editor. These are subsequent #830 workstreams; only internally configured
  options are selectable now. No automatic bulk migration of legacy prices.

## Acceptance remains for the larger #830

- Configurable business wizard (tariffs, duration and add-ons), including
  existing packages and class tariff data with clear compatibility.
- Dynamic bookable duration and per-extra-hour price require extending
  `calculateSlots` and schedule rules before exposing such prices.
- Full customer flow for `ON_REQUEST_WINDOWS`: server-chosen priced option
  resource IDs, user-chosen base unit, idempotency and transaction preview.
- Calendar and Telegram representation, schema audit on DEV and manual QA.
