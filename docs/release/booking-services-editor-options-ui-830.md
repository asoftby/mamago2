# #830 — Services and Prices editor / option picker (2026-10-29)

## Retained single sources of truth

- Offer editor: use existing **«Услуги и цены»** wizard step
  (`Step5Pricing`), not a second publishing workflow. Existing
  `Offer.priceItems`, `OfferClassGroup/OfferClassTariff`, `campSessions`,
  `PackageComponent` remain unchanged and continue their current UI and
  request-only/camp/party flows.
- Booking pricing: `OfferBooking.basePriceByn`,
  `OfferBookingOption` and `BookingRequest.bookingPriceSnapshot` from
  PR #941. This editor saves **only operational booking pricing**, without
  modifying catalog display prices or historical bookings.
- Existing resource availability and allocations: `BookingUnit`,
  `BookingUnitOffer`, `BookingAllocation`, `reserveSlot`; all
  resource-linked add-ons are checked and booked in the same transaction.
- The services editor appears for an **existing saved offer**. During initial
  offer creation it offers to save a draft first; this avoids creating
  detached options and respects existing wizard save/moderation.

## Business API and concurrency safety

`GET/PUT /api/business/offers/[id]/booking-services`:
- same authenticated place permission as the existing offer editor
  (`canManagePlaceAsync`) and owner-business scoping;
- independently versioned `OfferBooking.pricingRevision` (safe additive
  migration). Two tabs cannot silently overwrite prices;
- all inputs validated; rejects cross-tenant / unlinked / inactive resource,
  and resource extras for active group sessions; max 20 options; INCLUDED=0;
- writes base and options transactionally under an Offer row lock;
- deleting an option never deletes the immutable snapshot in previous
  `BookingRequest` rows.
- The editor's save button is explicit and separate from offer text draft.
  A 409 prompts refreshing data rather than silent conflict overwrite.

## Customer choice and price preview

- Existing `ClassBookingOverlay` loads a public sanitized option list via
  `GET /api/public/offers/[id]/price-quote`. Only INCLUDED and OPTIONAL,
  no internal resource identifiers, no inactive/unpublished items or
  STANDALONE products.
- Select optional extras; included extras are displayed as already selected.
  Changing tariff, seats, date/time or selected extras reruns the **server**
  price-only POST quote with stale requests cancelled.
- The submit button is blocked until a valid quote is returned. Reservation
  forwards only option IDs (not client prices) through the already-existing
  class reserve endpoint.
- `reserveSlot` recalculates inside its transaction, holds inventory, writes
  selected options and total snapshot. A quote is not a guarantee of
  availability or payment.
- This does not enable generic REQUEST_ONLY offer requests to book inventory;
  it only integrates the existing public **classes** time-slot overlay. Wider
  offer/party UI remains #830/#824 work.

## Automated verification

- Existing PostgreSQL `Classes reservation DB integration` is extended
  to cover: B2B pricing edit → option/link to resource → reservation →
  immutable snapshot → subsequent price edit; tenant/resource isolation;
  stale editor revision; group-resource rejection; all-or-nothing held
  allocations and cancellation.
- Main CI contract checks the single existing wizard step, public sanitized
  GET/POST pricing, and ID-only reservation payload.
- Run full CI and connected birthday, repeated-task and class PostgreSQL
  regressions before merge.
- DEV acceptance after the **combined manual DEV deploy**: open business
  offer editor, save pricing, select extras in public class overlay, change
  seats/group/tariff/time, verify recalculation, create booking, inspect
  business and parent orders, confirm/cancel and check calendar. Also test
  a second editor tab returning 409. No automatic deployment activated.

## Remaining #830 scope

- Shared dynamic duration pricing, hourly extensions, discounts, and
  minimum slot logic are **not yet implemented**. No misleading time choice
  or hourly pricing is exposed here.
- Users booking places/parties via other request-only flows cannot yet select
  and atomically reserve extra resources. This PR does not claim full
  booking completion.
- Existing B2B catalogue price and operational reservation price are
  **distinct fields**. Product-level consolidation of those price editors
  should be specified before eliminating legacy display-only pricing.
