# #830 — idempotent public slot reservation

- Existing booking entrypoint: `POST /api/public/offers/[id]/reserve`.
  New optional `idempotencyKey` is a client-generated UUID. Legacy callers
  with no key keep current behavior.
- The existing `ClassBookingOverlay` retains the UUID for network retries of
  **the same serialized customer intent**; changed contact data, slot, seats,
  tariff, child or extras creates a different key. Key reset on successful
  submission or when the overlay closes.
- `reserveSlot` validates the key, calculates SHA-256 of the canonical
  customer intent including identity, participants, requested units, selected
  extras, and hold duration. Prices and mutable availability are intentionally
  not included, so a retry cannot reprice an already-placed order.
- Inside the existing booking transaction, a per-offer UUID advisory lock
  serializes overlapping retries. Before any availability checks, the service
  searches for the existing `BookingRequest` and returns its original
  booking ID, saved hold expiration, and **actual current status**. A reused
  key with a different intent is a validation error (HTTP 400).
- Nullable `BookingRequest.slotIdempotencyKey` plus
  `slotRequestHash`, with PostgreSQL UNIQUE (`offerId`, `slotIdempotencyKey`)
  are additive. Historical bookings and other booking paths have NULL keys;
  they are not rewritten. Database uniqueness protects against implementation
  regressions and hash collision cannot merge different order rows.
- Service side effects and audit are executed only if a new row was inserted.
  A replay cannot allocate more resources, change prices, renew a hold, or
  send duplicate booking-created notifications.
- Class booking UI displays current saved status and does not promise an
  active hold after the original hold deadline.
- Disposable PostgreSQL tests: parallel requests with the same key create
  **one BookingRequest/BookingActivity/BookingAllocation**; conflicting
  payload reuse rejected; a new key is an independent attempt blocked by
  existing resource occupancy. Pure tests verify canonical hashing.

**Scope:** this key is for the public *slot* path only. Generic request-only,
party-provider invitation, and camp flows are unchanged and should gain
idempotency at their existing command entrypoints in separate work. No
automatic DEV/PROD deployment.

After the combined manual DEV deploy: submit a class reservation, force a
network retry with the same key, verify same ID and no duplicate notification,
change option/seats and use a different key, confirm that availability and
pricing are still server-authoritative. New Prisma migration must be applied
through existing safe backup/migration gates.
