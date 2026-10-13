# Business inbox, server-only (decision approved 2026-10-13)

**Dependency:** PR #529 (party draft & anchor); schema PR #526 merged but DEV migration/E2E gate not yet passed. This PR **does not** modify the business bookings UI or migrate/deploy databases.

## Tabs and groups

- ACTION_REQUIRED — «Требуют действий» (default, including when empty).
  - CUSTOMER_WAITING — «Клиент ждёт». **Only this group increments the menu badge.**
  - HOUSEKEEPING — «Закройте прошедшие». Never increments the badge.
- UPCOMING — «Предстоящие».
- AWAITING_CUSTOMER — «Ожидают клиента».
- ARCHIVE — «Архив».

All status mapping, sorting and counts use the same `bookingBucket()` classifier.
`GET /api/business/bookings/inbox?tab=action&kind=party` returns
`items`, `counts`, `totals`, `actionGroups`, `menuBadge`,
`nearestUpcoming`, `hasMore`. Accepted `tab` values:
`action`, `upcoming`, `customer`, `archive`, or native bucket values.
Accepted `kind`: `all`, `standard`, `party`.
`limit`: 1..100 (default 100).
Counts are computed from all matching business requests, NOT from page slice.
Items deliberately omit parent/customer contact fields: a PARTY is private
until it is confirmed; existing STANDARD details API remains unchanged.

In the first UI tab show CUSTOMER_WAITING first; HOUSEKEEPING below.
Empty state shows "Всё обработано" + `nearestUpcoming`.
No changes to existing standard business-bookings API and UI until UI PR.

## Booking status mapping

- STANDARD NEW → ACTION_REQUIRED/CUSTOMER_WAITING.
- STANDARD CONFIRMED + service date in future → UPCOMING.
- STANDARD CONFIRMED + past service date → ACTION_REQUIRED/HOUSEKEEPING.
- STANDARD CONFIRMED + no date → UPCOMING, after 30 days since
  `firstResponseAt ?? createdAt` → HOUSEKEEPING.
- STANDARD COMPLETED/CANCELLED/REJECTED/EXPIRED → ARCHIVE.
- PARTY SENT/AWAITING_RECONFIRM → ACTION_REQUIRED/CUSTOMER_WAITING,
  but expired `responseDueAt` reads as ARCHIVE (worker persists EXPIRED).
- PARTY QUOTED + ACTIVE latest quote and validUntil in future →
  AWAITING_CUSTOMER.
- PARTY QUOTED + expired latest quote → ACTION_REQUIRED/CUSTOMER_WAITING,
  with action EXTEND_OR_CLOSE. **Do not expire whole request** on quote
  validUntil. If the service itself has passed, display in ARCHIVE.
- PARTY CONFIRMED → date-based UPCOMING/HOUSEKEEPING.
- PARTY DECLINED/EXPIRED/NOT_ACCEPTED/CANCELLED → ARCHIVE.
- PARTY valid stage/status pair is asserted by `assertPartyStatusPair`.
  Mismatch raises server error rather than silently polluting totals.

## Server-side actions

- `POST /api/business/bookings/{id}/outcome` with
  `{ "outcome": "HELD" }` or
  `{ "outcome": "NOT_HELD", "reason": "CLIENT_NO_SHOW" | "CANCELLED_BY_PHONE" }`.
  Requires active/confirmed STANDARD and past service date; CAS update,
  activity history + audit. HELD→COMPLETED; NOT_HELD→CANCELLED, **not
  REJECTED**. No after-the-fact cancellation SMS to customer.
- `POST /api/business/party-requests/{id}/resolve` requires active
  business role and `Idempotency-Key`; body EXTEND
  `{action,expectedQuoteVersion,validUntil}` or CLOSE
  `{action,expectedQuoteVersion}`. Only QUOTED whose current ACTIVE quote
  expired, CAS update booking then order then quote, versioned new quote,
  new outbox event, idempotent retries. New deadline is at most 24 hours
  and strictly before the event; close transitions to NOT_ACCEPTED/CANCELLED.
- Reminder: PARTY AWAITING_RECONFIRM from PR 6 is a **client-accepted
  quote awaiting business confirmation**, not an actual CONFIRMED booking.
- Existing `GET /api/business/party-requests` and outbox worker preserved.

## Deferred and gates

1. New unified mobile UI/cards and `/business/bookings/{id}` details/quote
   history are the **second PR**, not the server PR.
2. Existing bookings menu badge will be wired to `menuBadge` in UI PR.
3. Customer-requested reschedule/cancel needs an explicit state later.
4. Canonical `NOT_ACCEPTED` uses BookingStatus.CANCELLED; preserve
   this pairing in PR6 quote acceptance and expiry flows.
5. The pilot implementation evaluates all rows to generate exact dynamic
   badge counts. Before large-scale rollout replace with indexed
   pagination/aggregates; do not impose a silent 100-row counting limit.
6. PR #529 integration, schema migration smoke/DEV gate, multi-business E2E,
   and completion of PR6 parent acceptance remain prerequisites for release.
