# Telegram Webhook — Dev Setup

## Как это работает

В dev-режиме (`NODE_ENV !== "production"`) используется **DEV-бот**:
- Токен: `TELEGRAM_BOT_TOKEN_DEV` из `.env.local`
- Username: `TELEGRAM_BOT_USERNAME_DEV` из `.env.local`

В prod — `TELEGRAM_BOT_TOKEN_PROD` / `TELEGRAM_BOT_USERNAME_PROD`.

Логика в `src/server/config/telegram.config.ts`.

---

## Требования

- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/) установлен
- `.env.local` содержит `TELEGRAM_BOT_TOKEN_DEV` с реальным токеном от BotFather

---

## Шаг 1 — Запустить туннель

```bash
cloudflared tunnel --url http://localhost:3000
```

Скопируй выданный URL вида `https://xxxx-xxxx.trycloudflare.com`.

> Важно: туннель должен указывать на `localhost:3000`, а не на `mamago.local:3000`.

---

## Шаг 2 — Установить webhook

Замени `TUNNEL_URL` на реальный URL из шага 1.

Без secret (dev, быстро):
```bash
export TELEGRAM_BOT_TOKEN="$(grep TELEGRAM_BOT_TOKEN_DEV .env.local | cut -d= -f2)"
export TUNNEL_URL="https://xxxx-xxxx.trycloudflare.com"

curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${TUNNEL_URL}/api/bot/webhook\"}"
```

С secret (рекомендуется):
```bash
export TELEGRAM_BOT_TOKEN="$(grep TELEGRAM_BOT_TOKEN_DEV .env.local | cut -d= -f2)"
export WEBHOOK_SECRET="$(grep TELEGRAM_WEBHOOK_SECRET_DEV .env.local | cut -d= -f2)"
export TUNNEL_URL="https://xxxx-xxxx.trycloudflare.com"

curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${TUNNEL_URL}/api/bot/webhook\", \"secret_token\": \"${WEBHOOK_SECRET}\"}"
```

Ожидаемый ответ:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

---

## Шаг 3 — Проверить webhook

```bash
export TELEGRAM_BOT_TOKEN="$(grep TELEGRAM_BOT_TOKEN_DEV .env.local | cut -d= -f2)"

curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

Поле `url` должно содержать `...trycloudflare.com/api/bot/webhook`.

---

## Шаг 4 — Проверить endpoint локально

```bash
curl http://localhost:3000/api/bot/webhook
```

Ожидаемый ответ: `405 Method Not Allowed` (GET не поддерживается — это нормально, endpoint принимает только POST от Telegram).

---

## Сброс webhook (если нужно)

```bash
export TELEGRAM_BOT_TOKEN="$(grep TELEGRAM_BOT_TOKEN_DEV .env.local | cut -d= -f2)"

curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook"
```

---

## Частые ошибки

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `404 Not Found` | Используется плейсхолдер `YOUR_TELEGRAM_BOT_TOKEN` | Подставь реальный токен из `.env.local` |
| `502 Bad Gateway` | Туннель указывает на `mamago.local` | Используй `localhost:3000` |
| `401 Unauthorized` | Неверный токен | Проверь `TELEGRAM_BOT_TOKEN_DEV` в `.env.local` |
| Webhook не получает обновления | Сервер не запущен или туннель упал | Перезапусти `pnpm dev` и `cloudflared` |

---

## Переменные в .env.local

```dotenv
TELEGRAM_BOT_TOKEN_DEV=реальный_токен_от_BotFather
TELEGRAM_BOT_USERNAME_DEV=@имя_бота
```

> `YOUR_TELEGRAM_BOT_TOKEN` — это плейсхолдер. Никогда не используй его как есть.
