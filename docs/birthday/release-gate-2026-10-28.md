# Birthday constructor — PR-1 release gate

Issue: #863. Baseline: `dev` at `308fe8c39eb95683d2762956ee187baa30b1836d` (2026-10-28).

## Rules
- Do not point integration tests at DEV or PROD databases. Use only the disposable local databases hard-coded in the test guards.
- Do not run database migrations or deploy on DEV/PROD as part of these tests.
- Mark an item PASS only after the corresponding command ran and evidence was captured. A test file's existence is not PASS.
- Gate applies separately to each deployment environment. Do not infer runtime flags, cron, bot connection, or migrations from source code.

## Stage 1: static + isolated DB verification
- [ ] Current PR rebased on live `dev`; SHA captured.
- [ ] Typecheck + lint + all birthday unit/contract tests pass.
- [ ] Run `src/server/birthday/partyConfirmation.postgres.integration.test.ts` against its guarded **localhost:5434/mamago_birthday_it** only.
- [ ] Run `src/server/birthday/partyCancel.postgres.integration.test.ts` against its guarded disposable database only, after checking that test's own connection guard.
- [ ] Run `src/server/birthday/partyQuoteExpiry.postgres.integration.test.ts` against its guarded disposable database only.
- [ ] Run `src/server/birthday/partyFullFlow.integration.test.ts` against its guarded **127.0.0.1:55443/mamago_birthday_it** only.
- [ ] Check race: two requests using the same `BookingUnit` and overlapping time; exactly one `CONFIRMED` allocation. Verify constraint `BookingAllocation_no_active_overlap` is installed in test DB.
- [ ] Check idempotency: replay submit, accept quote, confirm (dashboard and Telegram); no duplicate quote/allocation.
- [ ] Check stale callback after cancellation, expiry, removed membership and disabled confirmation flag; no state mutation.
- [ ] Check time-window exceptions, prep/cleanup, capacity, and a newly busy resource between preview and confirm.

## Stage 2: DEV operational smoke (read-only inspection except dedicated test transactions)
- [ ] Confirm current deployed SHA and `prisma migrate status` on DEV; do not apply migrations as part of gate.
- [ ] Verify `PARTY_CONFIRMATION_ENABLED`, `TELEGRAM_BUSINESS_DELIVERY_ENABLED`, and bot webhook are configured for intended DEV test; do not disclose secrets.
- [ ] Confirm authenticated `/api/cron/party-outbox` runs and `expirePartyRequests` + `dispatchPartyOutbox` execute on schedule.
- [ ] In dedicated DEV test data, verify A: parent → business inbox → quote → accept → Telegram confirm → parent UI; verify one allocation.
- [ ] Verify C/D/F refusal, timeout, cancellation, stale button; verify expected UI statuses and notifications.
- [ ] Review `PartyOutbox` FAILED after 5 attempts and `NotificationDelivery` ambiguous PENDING. No unmonitored, unresolved items before launch.
- [ ] Verify business without Telegram can process all required actions in dashboard.
- [ ] Record one timestamped evidence link/log (sanitized) per check.

## Exit
**GO** requires all P0 checks passing; missing E2E is **NOT VERIFIED**, never PASS. If stage 2 exposes defects, file focused follow-up PRs linked to #863. Do not merge solely because this checklist exists.

## Source anchors
- `prisma/migrations/20261011223000_party_order_and_booking_units/migration.sql` — exclusive allocation constraint.
- `src/server/birthday/partyUnitAllocation.ts` — row lock / availability.
- `src/server/birthday/partyConfirm.service.ts` — transactional confirmation.
- `src/server/birthday/partyQuoteAcceptance.service.ts` — acceptance ≠ reservation.
- `src/server/birthday/partyTelegramConfirmAction.service.ts` — authenticated action.
- `src/server/birthday/partyOutbox.service.ts` and `src/app/api/cron/party-outbox/route.ts` — delivery and expiries.
