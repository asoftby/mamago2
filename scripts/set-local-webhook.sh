#!/usr/bin/env bash
# Переустанавливает Telegram-вебхук dev-бота на текущий ngrok-туннель.
# Требует: запущенный ngrok (web-интерфейс на :4040), curl, python3.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"
DEV_PORT="${DEV_PORT:-3000}"

TOKEN=$(grep '^TELEGRAM_BOT_TOKEN_DEV=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
SECRET=$(grep '^TELEGRAM_WEBHOOK_SECRET_DEV=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')

[ -n "$TOKEN" ] || { echo "TELEGRAM_BOT_TOKEN_DEV не найден в .env.local"; exit 1; }
[ -n "$SECRET" ] || { echo "TELEGRAM_WEBHOOK_SECRET_DEV не найден в .env.local"; exit 1; }

# Берём https-туннель, который указывает на порт dev-сервера,
# чтобы не схватить чужой туннель, если их несколько.
NGROK_URL=$(curl -fsS http://localhost:4040/api/tunnels | python3 -c "
import json, sys
port = '$DEV_PORT'
tunnels = json.load(sys.stdin)['tunnels']
for t in tunnels:
    addr = t.get('config', {}).get('addr', '')
    if t['public_url'].startswith('https') and addr.rsplit(':', 1)[-1] == port:
        print(t['public_url'])
        break
")
[ -n "$NGROK_URL" ] || { echo "Нет https-туннеля на порт $DEV_PORT (ngrok запущен? localhost:4040)"; exit 1; }

WEBHOOK_URL="$NGROK_URL/api/bot/webhook"
echo "Ставлю вебхук: $WEBHOOK_URL"

curl -fsS "https://api.telegram.org/bot$TOKEN/deleteWebhook?drop_pending_updates=true" >/dev/null
curl -fsS "https://api.telegram.org/bot$TOKEN/setWebhook" \
  --data-urlencode "url=$WEBHOOK_URL" \
  --data-urlencode "secret_token=$SECRET" >/dev/null

BOT_USERNAME=$(curl -fsS "https://api.telegram.org/bot$TOKEN/getMe" |
  python3 -c "import json,sys; print(json.load(sys.stdin)['result']['username'])")

curl -fsS "https://api.telegram.org/bot$TOKEN/getWebhookInfo" | python3 -c "
import json, sys
r = json.load(sys.stdin)['result']
print('bot: @$BOT_USERNAME')
print('url:', r.get('url'))
print('last_error:', r.get('last_error_message', '—'))
"
