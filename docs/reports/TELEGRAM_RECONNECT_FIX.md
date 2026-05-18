# Telegram Reconnect Fix — Audit & Changes

## Root Cause

When a user disconnects Telegram and reconnects, Telegram already has the chat started. Opening the deep link `https://t.me/<bot>?start=link_<token>` may just open the chat without sending a new `/start link_<token>` command. The backend only completes the connection when it receives this specific command via webhook, so the polling never sees `linked=true` and the UI hangs forever in "Ожидаем подключение…".

## Changes Made

### 1. [`src/hooks/useTelegramConnectionStatus.ts`](src/hooks/useTelegramConnectionStatus.ts)
- Added `onTimeout` callback option — called when polling exceeds `timeoutMs` (default 90s)
- Added `timedOut` boolean state — lets the component know polling expired
- Added `resetTimeout()` function — allows resetting timeout state for retry
- The hook now properly fires `onTimeout` once (guarded by ref)

### 2. [`src/server/services/telegramLink.service.ts`](src/server/services/telegramLink.service.ts)
- Added `command` field to `createTelegramLink()` return value: `/start link_<token>` — so the frontend can show the manual command
- Added `CreateTelegramLinkResult` type export
- Added detailed dev logging in `consumeTelegramLinkToken()` for each failure reason:
  - Token not found
  - Environment mismatch
  - Already used (`usedAt` exists)
  - Expired (`expiresAt <= now`)

### 3. [`src/components/business/notifications/NotificationSettingsTable.tsx`](src/components/business/notifications/NotificationSettingsTable.tsx)
- Added `linkCommand` and `linkBotUsername` state — stores the manual command from `/api/settings/telegram/link`
- `handleConnectTelegram` now captures `command` and `botUsername` from the API response
- Added `handleCopyCommand` — copies `/start link_<token>` to clipboard with visual feedback
- Added `handleRetryConnect` — resets timeout state, clears command, and re-initiates connection
- Hook integration now passes `onTimeout` callback: stops `isPolling` so the button becomes active again
- **Polling timeout (90s)**: after timeout, `isPolling` is set to `false`, the hook reports `timedOut=true`
- After timeout:
  - Button shows "Подключить заново"
  - Fallback block appears with the manual command and "Копировать" button
  - Text explains: "Если Telegram уже открыт, отправьте боту команду вручную"
- Button `disabled` logic updated: `(isPolling && !pollingTimedOut)` — so after timeout the button is re-enabled
- The `useCallback` wrappers were removed from `handleRetryConnect` to avoid stale closure issues

### 4. [`src/app/api/settings/telegram/link/route.ts`](src/app/api/settings/telegram/link/route.ts)
- No changes needed — it already returns the full `result` object from `createTelegramLink`, which now includes `command`

### 5. [`src/server/services/telegram/TelegramWebhookService.ts`](src/server/services/telegram/TelegramWebhookService.ts)
- Existing dev logging was already adequate (logs chatId, payload, token, consume result)
- Detailed token validation logging added upstream in `telegramLink.service.ts` `consumeTelegramLinkToken`

### 6. [`src/app/api/bot/webhook/route.ts`](src/app/api/bot/webhook/route.ts)
- Existing dev logging already covers: update_id, type, text, chatId, processing status

## Dev Debug Checklist

### Check if webhook is set correctly:
```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN_DEV/getWebhookInfo"
```
Expected: `url` should point to `https://<tunnel-url>/api/bot/webhook`

### Check webhook receives updates:
```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN_DEV/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id":"<your_chat_id>","text":"/start link_test123"}'
```
Then check dev server logs for `[telegram:webhook]` entries.

### Trace the reconnect flow:
1. Frontend → `POST /api/settings/telegram/link` → returns `{ url, command }`
2. Frontend opens `url`, starts polling `/api/settings/telegram/status`
3. Telegram sends webhook → `POST /api/bot/webhook`
4. `TelegramWebhookService.handleMessage()` → parses `/start link_<token>`
5. `consumeTelegramLinkToken()` validates + upserts `TelegramConnection`
6. Frontend polling sees `linked=true` → stops polling, shows success

### If reconnection hangs:
1. Check dev server logs for `[telegram:webhook]` — if no logs, webhook isn't being called
2. Check `getWebhookInfo` URL
3. Check `[telegram:link] consumeTelegramLinkToken FAIL` for detailed reason
4. After 90s timeout, UI shows fallback command — user can copy and send manually
