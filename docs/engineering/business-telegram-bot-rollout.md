# Business Telegram Bot — staged rollout (2026-10-22)

Phase 1 introduces distinct business bot credentials, webhook, opt-in linking and independent database records. Family `TelegramConnection` and `/api/bot/webhook` are unchanged. There is NO automatic migration of family subscriptions; a business user must opt in explicitly.

## Configuration (never commit secrets)

- `TELEGRAM_BUSINESS_BOT_TOKEN_DEV`, `TELEGRAM_BUSINESS_BOT_USERNAME_DEV`, `TELEGRAM_BUSINESS_WEBHOOK_SECRET_DEV`
- `TELEGRAM_BUSINESS_BOT_TOKEN_PROD`, `TELEGRAM_BUSINESS_BOT_USERNAME_PROD`, `TELEGRAM_BUSINESS_WEBHOOK_SECRET_PROD`

Register bot webhooks separately at `/api/business/telegram/webhook` with `secret_token`. Apply the new migration before enabling the UI. Without configuration, bot linking fails closed.

## Deliberately not shipped in phase 1

- Routing business notification delivery from the legacy family bot to the new bot. Current business notification dispatch still uses the existing user connection, and must not be silently replaced before a routing/permission audit.
- Booking confirmation callback actions, idempotency and role checks.
- Employee access revocation handling, monitoring and production smoke tests.

**DO NOT enable business Telegram delivery or advertise booking approvals until phase 2 is implemented and verified.** This change alone is not sufficient for a production business bot launch.

## Smoke tests

1. Existing family connection remains linked after connecting/disconnecting business bot.
2. A valid `/start business_<token>` links business bot on the matching DEV/PROD environment.
3. Replayed, expired or invalid link fails and does not alter state.
4. Wrong webhook secret returns 403.
5. Only an active business owner/manager can use the connection; prevent sending after revocation.
