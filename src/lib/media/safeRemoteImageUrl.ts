import { isIP } from "node:net";

/**
 * Базовая защита от SSRF при скачивании изображений по URL (импорт).
 */

function ipv4ToInt(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map(Number);
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return (((octets[0]! << 24) >>> 0) + (octets[1]! << 16) + (octets[2]! << 8) + octets[3]!) >>> 0;
}

function inIpv4Range(value: number, base: string, prefix: number): boolean {
  const baseValue = ipv4ToInt(base)!;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (baseValue & mask);
}

function isPublicIpv4(address: string): boolean {
  const value = ipv4ToInt(address);
  if (value === null) return false;

  return [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.88.99.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ].every(([base, prefix]) => !inIpv4Range(value, base as string, prefix as number));
}

function expandIpv6(address: string): number[] | null {
  const normalized = address.toLowerCase().split("%")[0]!;
  const [leftRaw, rightRaw, extra] = normalized.split("::");
  if (extra !== undefined) return null;
  const parseSide = (side: string | undefined): number[] | null => {
    if (!side) return [];
    const result: number[] = [];
    for (const part of side.split(":")) {
      if (part.includes(".")) {
        const ipv4 = ipv4ToInt(part);
        if (ipv4 === null) return null;
        result.push((ipv4 >>> 16) & 0xffff, ipv4 & 0xffff);
      } else {
        if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
        result.push(Number.parseInt(part, 16));
      }
    }
    return result;
  };
  const left = parseSide(leftRaw);
  const right = parseSide(rightRaw);
  if (!left || !right) return null;
  if (!normalized.includes("::")) return left.length === 8 ? left : null;
  const missing = 8 - left.length - right.length;
  return missing >= 1 ? [...left, ...Array(missing).fill(0), ...right] : null;
}

/** True only for globally routable IPv4/IPv6 destinations. */
export function isPublicIpAddress(address: string): boolean {
  const unwrapped = address.startsWith("[") && address.endsWith("]")
    ? address.slice(1, -1)
    : address;
  const family = isIP(unwrapped);
  if (family === 4) return isPublicIpv4(unwrapped);
  if (family !== 6) return false;

  const words = expandIpv6(unwrapped);
  if (!words) return false;
  // IPv4-mapped IPv6 must inherit the embedded IPv4 policy.
  if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
    const mapped = `${words[6]! >>> 8}.${words[6]! & 0xff}.${words[7]! >>> 8}.${words[7]! & 0xff}`;
    return isPublicIpv4(mapped);
  }
  // Public IPv6 unicast is currently allocated from 2000::/3. This excludes
  // unspecified, loopback, link-local, unique-local, multicast and docs.
  if ((words[0]! & 0xe000) !== 0x2000) return false;
  if (words[0] === 0x2001 && words[1]! <= 0x01ff) return false;
  if (words[0] === 0x2002) return false;
  // Documentation range 2001:db8::/32 is not globally reachable.
  if (words[0] === 0x2001 && words[1] === 0x0db8) return false;
  return true;
}

function isPrivateOrReservedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  const literal = h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;
  return isIP(literal) !== 0 && !isPublicIpAddress(literal);
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

  if (url.username || url.password || !url.hostname) {
    throw safeUrlError("Remote URL is not allowed");
  }

  if (isPrivateOrReservedHost(url.hostname)) {
    throw safeUrlError("Этот адрес недоступен для импорта");
  }

  return url;
}
