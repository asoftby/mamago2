# Birthday PR 5 — business replies and outbox

Status: draft, depends on PR #529 (which depends on merged PR #526).
Do not deploy without the PR #526 migration smoke on a production DB copy.

## Business journey

Business cabinet `/business/bookings` has two modes: ordinary requests (unchanged)
and "Праздники". The latter has "Требуют ответа" and "Все праздничные заявки".
`SENT` and `AWAITING_RECONFIRM` are actionable only until `responseDueAt`.

Responses:

- "Могу": actual BYN price and list of included services/terms required.
- "С изменениями": the same plus mandatory explanation of the changes.
- "Не могу": decline reason and optional comment (mandatory for OTHER).

The quote is a versioned `PartyQuote`. A positive response sets
`partyStage=QUOTED`, `PartyOrderItem.status=NEEDS_DECISION`, but never
`BookingStatus.CONFIRMED`. The parent must accept a quote in a later PR.
A decline sets `partyStage=DECLINED` and may mark an anchor order as
`NEEDS_ALTERNATIVE`. A re-confirmation does not retain a false
`BookingStatus.CONFIRMED`.

No parent contacts or private references are returned by the business listing
or outbox. Business access is resolved through active BusinessMember membership.
Inactive businesses cannot submit replies.

## Write guarantees

`POST /api/business/party-requests/:id/respond` requires a unique
`Idempotency-Key` and `expectedStage` / `expectedQuoteVersion`.
A transaction compare-and-swaps `lastActivityAt` and stage, then updates
the request, supersedes the active quote, creates the next version, records
`BookingActivity`, updates the party item and writes `PartyOutbox`.
`firstResponseAt` is recorded for positive and negative responses.

## Outbox operations

`GET /api/cron/party-outbox` uses the canonical CRON_SECRET Bearer auth.
Run from the scheduler periodically (for example, every minute). This PR does
**not** install a server scheduler or activate the endpoint in DEV/PROD.

One run expires up to 50 overdue `SENT` / `AWAITING_RECONFIRM` requests,
then dispatches up to 20 due outbox events. Events include
`PARTY_REQUEST_SENT`, `PARTY_QUOTE_SENT`, `PARTY_REQUEST_DECLINED` and
`PARTY_REQUEST_EXPIRED`.

The outbox claims each row with an atomic due-time lease and backoff, up to
five attempts. It creates in-app notifications with deterministic IDs and
`skipDuplicates`, then uses the existing `NotificationDelivery` service
for email/Telegram. It does not send Telegram messages inline from a user
request. Unknown event types and exhausted retries remain FAILED for manual
review; no PII is logged.

**Delivery semantics:** in-app notifications are idempotent. External channels
are best-effort with durable `NotificationDelivery` statuses; a PENDING row
left after a crash is ambiguous and is intentionally not auto-retried, because
Telegram might have accepted the message already. Inspect and reconcile those
rows manually. Exactly-once Telegram delivery is not claimed.

## Not included

- Parent acceptance of quote and real booking confirmation.
- Two-hour `BookingUnit` holds and allocation conflict handling.
- Telegram quick-action buttons.
- Reference image exchange / custom brief UI.
- Automated quote expiry and replacement matching.
- Scheduling the cron route on a server.

## Validation before rollout

- Run CI, `pnpm check:push`, and DB migration smoke on a copy of PROD.
- Create a real test party with two independent business accounts.
- Verify owner and manager can respond, unrelated businesses cannot.
- Simulate concurrent positive replies and replay the same idempotency key.
- Test expiry versus reply race, Telegram disabled/connected, worker crash,
  duplicate outbox processing and no contact leakage.
- Ensure DEV has an active CRON_SECRET and the scheduler is configured only
  after a deployment decision.
