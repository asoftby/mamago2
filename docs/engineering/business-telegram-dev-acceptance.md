# Business Telegram — DEV acceptance gate

Do not enable PROD or paste tokens into GitHub, chat, issue comments, command history, or logs.

## Existing implementation (verify current dev before launch)
- Separate business bot config: `TELEGRAM_BUSINESS_BOT_TOKEN_DEV`, `TELEGRAM_BUSINESS_BOT_USERNAME_DEV`, `TELEGRAM_BUSINESS_WEBHOOK_SECRET_DEV`.
- Optional delivery flag: `TELEGRAM_BUSINESS_DELIVERY_ENABLED` (keep **false** until initial link and webhook checks pass).
- Webhook: `/api/business/telegram/webhook`. Header `X-Telegram-Bot-Api-Secret-Token` must match the server's secret.
- Confirm button is limited to eligible `PARTY_QUOTE_ACCEPTED` notifications with an unambiguous resource; other cases open the business cabinet.

## Before testing on DEV
1. Verify the running app and worker image SHA matches the intended release. Check `https://dev.mamago.by/api/health` for `status`, `db`, `buildId`, `gitSha`; do not assume successful Docker build means deployed.
2. Check schema migrations and app/worker health, take backup and ensure rollback is available.
3. On the DEV host, verify the **names and presence only** of the four variables in the actual container environment. Do not print values. Ensure Compose forwards them to the app **and worker** as required. Never change PROD's environment.
4. Set the DEV webhook to `https://dev.mamago.by/api/business/telegram/webhook`, using `secret_token` with the same DEV-only secret. Check Telegram `getWebhookInfo`: expected URL, no persistent delivery errors. Never expose API requests containing bot tokens.
5. Keep delivery flag disabled, then test the business-cabinet connection with an authorized OWNER/MANAGER in a private chat. Ensure invalid/expired/replayed link tokens and non-members do not link.

## Explicit opt-in
After steps 1–5 pass, enable `TELEGRAM_BUSINESS_DELIVERY_ENABLED=true` in **DEV only**, restart/redeploy just DEV per the owner's existing Telegram deployment workflow, and verify that the new process received the value.

## Acceptance matrix (record pass/fail and booking IDs privately)
- Valid new PARTY quote → outbox → notification to the correct opted-in business bot user.
- Accepted quote, exactly one eligible booking resource → signed `Подтвердить заявку` → successful Telegram acknowledgment → correct booking transition and outbox events.
- Multiple eligible rooms or ambiguous availability → **no one-tap confirmation**, safe cabinet link.
- Replay same callback; stale quote version; expired quote; missing/disabled connection; revoked OWNER/MANAGER role; inactive business; wrong chat; expired/altered signed token; arbitrary Telegram payload: no unauthorized state transition.
- Worker retry and Telegram API failure: no fallback to family Info Bot, no duplicate booking transition. Inspect redacted logs only.
- Decline/change terms: verify business cabinet fallback; standalone Telegram actions are not yet implemented and are **not accepted as complete**.

## Decision
Record actual DEV image digest + git SHA, migration evidence, bot link, positive/negative matrix, and log outcome in release issue #702. Only then consider PROD configuration and a separate, explicitly approved rollout.
