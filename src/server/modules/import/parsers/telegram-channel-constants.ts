/**
 * Общие константы и проверки для импорта публичных Telegram-каналов.
 * Отдельный файл без зависимостей, чтобы его мог импортировать и сервис
 * источников, и парсер.
 */

export const TELEGRAM_CHANNEL_PARSER_KEY = "telegram-channel-event";

const CHANNEL_NAME_RE = /^[A-Za-z0-9_]{5,32}$/;

/** Имя канала из `https://t.me/s/<канал>` или `https://t.me/<канал>`; иначе null. */
export function parseTelegramChannelName(baseUrl: string | null | undefined): string | null {
  if (!baseUrl) return null;
  let url: URL;
  try {
    url = new URL(baseUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "t.me") return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const name = segments[0] === "s" ? segments[1] : segments[0];
  return name && CHANNEL_NAME_RE.test(name) ? name : null;
}

/** Хосты страниц: только веб-превью Telegram. */
export function isTelegramPageHost(hostname: string): boolean {
  return hostname.toLowerCase() === "t.me";
}

/** Хосты картинок постов: CDN Telegram. */
export function isTelegramImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "t.me" ||
    host === "telesco.pe" ||
    host.endsWith(".telesco.pe") ||
    host === "cdn-telegram.org" ||
    host.endsWith(".cdn-telegram.org")
  );
}
