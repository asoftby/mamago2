# Party quote acceptance and business confirmation — release gate

Tracking: #656, #666 (parent acceptance), #672 (business confirm), #655 (business inbox).
Do **not** ship any one PR on its own or enable BUSINESS_BOOKINGS_INBOX_UI before all components pass DEV smoke.

## State machine
1. Anchor request: SENT / NEW; business proposes a versioned quote: QUOTED / NEW.
2. Parent accepts **that specific active version** before its deadline: AWAITING_RECONFIRM / NEW, quote ACCEPTED. This is NOT a reservation.
3. Business confirms accepted version before the reconfirmation deadline: CONFIRMED / CONFIRMED.
   For VENUE/PACKAGE anchor, an ACTIVE BookingUnit attached to the offer is mandatory,
   its hours, exceptions, CalendarBlock, capacity and existing allocations are rechecked under transaction locks.
   The confirmed BookingAllocation is inserted atomically and protected by PostgreSQL's exclusion constraint.
4. Only after the anchor has confirmed does the same transaction create requests for
   other selected STANDALONE/ADDON items; INCLUDED package items are marked confirmed.
5. Businesses cannot confirm a non-anchor item until the order is ANCHOR_CONFIRMED.
6. HOME/OUTDOOR services with no BookingUnit rely on the business's explicit manual confirmation.
   No exclusive inventory guarantee is implied for unconfigured services.
7. A changed business reply supersedes an earlier ACCEPTED quote and starts a new QUOTED version.

## Manual & integration checks before release
- Two businesses: verify no access to each other's requests or quotes.
- One quote accepted twice (same version); different quote/version conflict; expired quote conflict.
- Business confirmation retried with the same/different idempotency key.
- Two simultaneous business confirmations competing for one resource; only one must succeed.
- Another STANDARD booking already holds/confirms the unit: party confirmation must fail.
- Full-day CLOSED / partial CLOSED / OPEN_OVERRIDE / CalendarBlock collisions.
- Unit deactivated after parent acceptance or detached from offer; must fail.
- More guests than unit capacity; must fail.
- Two+ units: business must select one; selecting another company's unit must fail.
- GET /api/business/party-requests/[id]/units is only a read-only availability preview;
  POST /confirm rechecks inside the transaction. No selected room is a guarantee before confirmation.
- Party VENUE/PACKAGE lacking a configured active unit must fail closed.
- Anchor confirmation creates exactly one request per available selected service;
  unavailable add-on marked NEEDS_DECISION; package INCLUDED not externally requested.
- Customer details stay hidden from business before the allowed stage.
- Mobile and desktop parent action shows price/terms and explicitly says the reservation
  is not yet confirmed. Business inbox action is separate from /respond.
- Outbox retries do not cause duplicate messages. Notifications deep-link to live deployed screens.
- Schema migrations: none. Do not operate on PROD. Tests involving inserts/deletes only on
  an explicitly isolated local integration database.

## Rollout order
Merge #666 → #672 → #655 after review and the checks above. Run DEV smoke and
only then enable BUSINESS_BOOKINGS_INBOX_UI in both app and worker in the DEV environment.
PROD release/flag activation is a separate decision after verifying DEV.
