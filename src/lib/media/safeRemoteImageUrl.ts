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
    // IPv6: упрощённо блокируем loopback / link-local префиксы
    if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  }

  return false;
}

export function assertSafeRemoteImageUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Пустой URL");

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Некорректный URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Разрешены только http и https");
  }

  if (isPrivateOrReservedHost(url.hostname)) {
    throw new Error("Этот адрес недоступен для импорта");
  }

  return url;
}
