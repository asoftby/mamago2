/**
 * Базовая защита от SSRF при скачивании изображений по URL (импорт).
 */

function isPrivateOrReservedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0") return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const m = h.match(ipv4);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }

  if (h.includes(":")) {
    // URL.hostname always keeps the brackets for an IPv6 literal
    // (e.g. "[::1]"), so strip them before matching prefixes below —
    // otherwise every IPv6 loopback/link-local check here silently never
    // matches and the host is treated as public.
    const ipv6 = h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;
    // IPv6: упрощённо блокируем loopback / link-local префиксы
    if (ipv6 === "::1" || ipv6.startsWith("fe80:") || ipv6.startsWith("fc") || ipv6.startsWith("fd")) {
      return true;
    }
  }

  return false;
}

/**
 * Tagged with `httpStatus: 400` so callers can classify the response without
 * matching on message text (see /api/media/from-url). Reused for both the
 * initial URL and every redirect hop when downloading a remote image, so
 * redirects can't be used to reach a private/reserved host.
 */
function safeUrlError(message: string): Error {
  return Object.assign(new Error(message), { httpStatus: 400 as const });
}

export function assertSafeRemoteImageUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) throw safeUrlError("Пустой URL");

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw safeUrlError("Некорректный URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw safeUrlError("Разрешены только http и https");
  }

  if (isPrivateOrReservedHost(url.hostname)) {
    throw safeUrlError("Этот адрес недоступен для импорта");
  }

  return url;
}
