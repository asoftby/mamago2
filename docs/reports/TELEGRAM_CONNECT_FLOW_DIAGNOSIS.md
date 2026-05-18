# Диагностика Telegram connect flow

**Дата:** 2026-05-13  
**Симптом:** После нажатия «Подключить» открывается бот, но `/start` ничего не делает.

---

## 1. Как генерируется Telegram-ссылка

**UI:** [`src/components/business/notifications/TelegramStatusRow.tsx:35`](../../src/components/business/notifications/TelegramStatusRow.tsx)  
— кнопка «Подключить» вызывает `POST /api/settings/telegram/link`

**API route:** [`src/app/api/settings/telegram/link/route.ts`](../../src/app/api/settings/telegram/link/route.ts)  
— вызывает `createTelegramLink({ userId })`

**Сервис:** [`src/server/services/telegramLink.service.ts:50-51`](../../src/server/services/telegramLink.service.ts)  
```
https://t.me/{botUsername}?start=link_{48-char-hex-token}
```

**Пример:**  
```
https://t.me/mamago_dev_bot?start=link_a3f9c2...48chars
```

**TTL токена:** 15 минут (`TELEGRAM_LINK_TTL_MS = 15 * 60 * 1000`).  
Токен хранится в `TelegramLinkToken` (Prisma), поле `environment` = `"DEV"` (в dev-среде).

---

## 2. Webhook route

**Endpoint (canonical):** `POST /api/bot/webhook`  
**Файл:** [`src/app/api/bot/webhook/route.ts`](../../src/app/api/bot/webhook/route.ts)

Два deprecated stub-а существуют (возвращают 410):
- `/api/integrations/telegram/webhook`
- `/api/telegram/webhook`

### Логика безопасности

| Условие | Поведение |
|---|---|
| `NODE_ENV=production` и `TELEGRAM_WEBHOOK_SECRET_PROD` не задан | **503 — Webhook not configured** |
| `webhookSecret` задан, заголовок не совпадает | **403 — Forbidden** |
| DEV, `webhookSecret` не задан | Пропускает без проверки |

В dev-среде: проверяет `TELEGRAM_WEBHOOK_SECRET_DEV` если задан (задан в `.env.local`).

---

## 3. Обработка `/start` в TelegramWebhookService

**Файл:** [`src/server/services/telegram/TelegramWebhookService.ts:59-156`](../../src/server/services/telegram/TelegramWebhookService.ts)

Логика:
1. Парсит текст: `/start link_<token>` → `payload = "link_<token>"`, `token = payload.slice(5)`
2. Если payload **не** начинается с `link_` → отправляет подсказку «Откройте ссылку из mamaGo»
3. Вызывает `consumeTelegramLinkToken({ token, telegramUserId, telegramChatId, ... })`
4. Отправляет пользователю: ✅ успех или ❌ «ссылка устарела»

### consumeTelegramLinkToken — условия отказа

**Файл:** [`src/server/services/telegramLink.service.ts:272-278`](../../src/server/services/telegramLink.service.ts)

Возвращает `{ ok: false, reason: "invalid_or_expired" }` если:
- токен не найден в БД
- `linkToken.environment !== config.environment` (DEV vs PROD)
- `linkToken.usedAt` уже заполнен (токен уже использован)
- `linkToken.expiresAt <= now` (прошло > 15 минут)

При успехе: делает `upsert` в `TelegramConnection`, помечает токен использованным.

---

## 4. Env-переменные

| Переменная | Значение (dev) | Статус |
|---|---|---|
| `TELEGRAM_BOT_TOKEN_DEV` | задан в `.env.local` | ✅ |
| `TELEGRAM_BOT_USERNAME_DEV` | `@mamago_dev_bot` | ✅ |
| `TELEGRAM_WEBHOOK_SECRET_DEV` | задан в `.env.local` | ✅ |
| `TELEGRAM_BOT_TOKEN_PROD` | не задан | — (prod не используется) |
| `TELEGRAM_BOT_USERNAME_PROD` | не задан | — |
| `TELEGRAM_WEBHOOK_SECRET_PROD` | не задан | ⚠️ prod вернёт 503 |
| `NEXT_PUBLIC_APP_URL` | `http://mamago.local:3000` | локальный, не публичный |

Конфиг: [`src/server/config/telegram.config.ts`](../../src/server/config/telegram.config.ts)  
В dev (`NODE_ENV !== "production"`) используются `_DEV`-суффиксы.

---

## 5. Актуальный статус webhook у Telegram

```
GET https://api.telegram.org/bot<token>/getWebhookInfo
```

**Ответ (получен 2026-05-13):**
```json
{
  "ok": true,
  "result": {
    "url": "https://curdier-unpensioned-vanda.ngrok-free.dev/api/bot/webhook",
    "pending_update_count": 1,
    "last_error_date": 1778704292,
    "last_error_message": "Wrong response from the webhook: 404 Not Found",
    "max_connections": 40
  }
}
```

**`pending_update_count: 1`** — одно необработанное обновление от пользователя висит в очереди.

---

## 6. Корневая причина

> **Webhook зарегистрирован на мёртвый ngrok-тоннель.**

```
https://curdier-unpensioned-vanda.ngrok-free.dev  →  404 Not Found
```

Когда пользователь отправляет `/start link_<token>` боту:
1. Telegram пытается отправить update на webhook-URL
2. Получает `404` — тоннель `curdier-unpensioned-vanda.ngrok-free.dev` больше не существует
3. Telegram повторяет с exponential backoff, но в итоге не доставляет
4. Пользователь не получает никакого ответа

**Весь остальной код работает корректно:** логика парсинга `/start`, валидация токена, `consumeTelegramLinkToken` — всё реализовано правильно. Проблема исключительно в том, что Telegram не может достучаться до приложения.

---

## 7. Точный минимальный фикс

### Шаг 1 — Запустить ngrok-тоннель

```bash
ngrok http 3000
# или если используется кастомный домен:
ngrok http --domain=<ваш-домен>.ngrok-free.app 3000
```

### Шаг 2 — Зарегистрировать новый webhook

```bash
BOT_TOKEN="<TELEGRAM_BOT_TOKEN_DEV из .env.local>"
WEBHOOK_URL="https://<новый-ngrok-хост>/api/bot/webhook"
WEBHOOK_SECRET="<TELEGRAM_WEBHOOK_SECRET_DEV из .env.local>"

curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${WEBHOOK_URL}\",
    \"secret_token\": \"${WEBHOOK_SECRET}\",
    \"allowed_updates\": [\"message\", \"callback_query\"]
  }"
```

### Шаг 3 — Проверить

```bash
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
# Ожидается: "url" = новый адрес, "last_error_message" отсутствует
```

### Шаг 4 — Проверить зависший update (опционально)

Если `pending_update_count` не обнулился — можно сбросить очередь:
```bash
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook" \
  -d "drop_pending_updates=true"
# Затем повторить setWebhook
```

---

## 8. Дополнительный риск (prod)

Если проект когда-либо задеплоится в `NODE_ENV=production` без `TELEGRAM_WEBHOOK_SECRET_PROD`, webhook-endpoint вернёт **503** (см. `route.ts:17-21`). Нужно добавить переменные `_PROD` перед деплоем.

---

## Резюме

| Компонент | Статус |
|---|---|
| Генерация ссылки (`t.me/...?start=link_...`) | ✅ работает |
| API `POST /api/settings/telegram/link` | ✅ работает |
| `TelegramWebhookService.handleMessage` | ✅ работает |
| `consumeTelegramLinkToken` | ✅ работает |
| Webhook endpoint `/api/bot/webhook` | ✅ код корректен |
| **Webhook URL у Telegram** | ❌ **мёртвый ngrok — 404** |
| Env dev-переменные | ✅ все заданы |
| Env prod-переменные | ⚠️ не заданы (503 в prod) |
