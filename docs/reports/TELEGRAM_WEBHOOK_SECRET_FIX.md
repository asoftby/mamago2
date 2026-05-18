# Telegram Webhook Secret Fix

## Problem

The Telegram webhook endpoint (`POST /api/bot/webhook`) validated the `x-telegram-bot-api-secret-token` header **only when** `config.webhookSecret` was truthy. If the environment variable was accidentally omitted in production, the endpoint would accept any POST request without secret verification, exposing the bot to unauthorized updates.

## Root Cause

In [`src/app/api/bot/webhook/route.ts`](../../src/app/api/bot/webhook/route.ts), the validation was wrapped in a conditional:

```ts
if (config.webhookSecret) {
  // validate header
}
```

When `TELEGRAM_WEBHOOK_SECRET_PROD` was not set, `config.webhookSecret` resolved to `null`, the condition was skipped, and all requests passed through unchecked.

## Fix

Added a production guard **before** the existing secret validation in [`src/app/api/bot/webhook/route.ts`](../../src/app/api/bot/webhook/route.ts):

```ts
// Production guard: webhook secret is mandatory in production
if (process.env.NODE_ENV === "production" && !config.webhookSecret) {
  return NextResponse.json(
    { error: "Webhook not configured" },
    { status: 503 },
  );
}
```

This ensures that in `NODE_ENV=production`:

- If `config.webhookSecret` is `null` → **503 Service Unavailable** is returned immediately, before any request processing.
- If `config.webhookSecret` is set → existing header validation proceeds (403 on mismatch, 200 on match).

In dev/local, the behavior is unchanged: if no secret is configured, requests are allowed (for local testing convenience).

## Changed Files

| File | Change |
|---|---|
| [`src/app/api/bot/webhook/route.ts`](../../src/app/api/bot/webhook/route.ts) | Added production guard (lines 16-22) before existing secret validation |

## Security Audit

- **No secret logged**: The error message on mismatch is `"Invalid webhook secret"` — the actual value is never written to logs.
- **No secret returned**: Responses never include the secret value — only `"Forbidden"` (403) or `"Webhook not configured"` (503).
- **Business logic untouched**: The `TelegramWebhookService.handleUpdate()` call and all downstream logic are unchanged.

## Required Environment Variables for Production

The following environment variable **MUST** be set in production for the webhook to function:

| Variable | Description | Config Field |
|---|---|---|
| `TELEGRAM_WEBHOOK_SECRET_PROD` | Secret token shared with Telegram via `setWebhook` | `config.webhookSecret` |

Without this variable, `POST /api/bot/webhook` returns **503 Service Unavailable** in production.

### Additional Telegram env vars (for reference)

| Variable | Purpose |
|---|---|
| `TELEGRAM_BOT_TOKEN_PROD` | Bot authentication token |
| `TELEGRAM_BOT_USERNAME_PROD` | Bot username for display/linking |
| `TELEGRAM_WEBHOOK_SECRET_PROD` | **Webhook secret (now mandatory in production)** |

For local/dev, the corresponding `_DEV` suffixed variables are used and remain optional.

## Verification

- `pnpm typecheck` — ✅ passes
- `pnpm lint` — ✅ passes
