import { createHash } from "node:crypto";

export function guestMaxLifetimeGenerations(): number {
  const raw = process.env.GUEST_MAX_GENERATIONS;
  if (raw !== undefined && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1) return Math.min(Math.floor(n), 10_000);
  }
  return 2;
}

/** Канонический UUID (crypto.randomUUID и др.) */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveGuestUsageKey(
  clientAnonymousId: string | null | undefined,
  ip: string | null,
  /** Разделяет гостей за одним IP (разные браузеры), если нет валидного anonymousId */
  userAgent?: string | null,
): string | null {
  const raw =
    typeof clientAnonymousId === "string" ? clientAnonymousId.trim() : "";
  if (raw && UUID_RE.test(raw)) {
    return `anon:${raw}`;
  }
  const trimmedIp = ip?.split(",")[0]?.trim();
  if (trimmedIp && trimmedIp.length > 0) {
    const pepper =
      process.env.GUEST_USAGE_IP_PEPPER ?? "mamago-guest-ip-pepper-dev";
    const uaSnippet =
      typeof userAgent === "string" ? userAgent.trim().slice(0, 256) : "";
    const hash = createHash("sha256")
      .update(`${pepper}:${trimmedIp}:${uaSnippet}`)
      .digest("hex")
      .slice(0, 48);
    return `iph:${hash}`;
  }
  return null;
}
