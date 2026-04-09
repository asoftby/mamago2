/**
 * URL для старта диалога с ботом (deep link).
 * Задайте NEXT_PUBLIC_TELEGRAM_BOT_URL (полная ссылка) или NEXT_PUBLIC_TELEGRAM_BOT_USERNAME.
 */
export function getTelegramBotConnectUrl(): string {
  const full = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL?.trim();
  if (full) return full;
  const name = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim();
  if (name) {
    const u = name.replace(/^@/, "");
    return `https://t.me/${u}`;
  }
  return "/me/settings/notifications";
}
