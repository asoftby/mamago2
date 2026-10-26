/**
 * `mg_territory` — the visitor's selected territory (slug), the single place the choice is stored.
 * Replaces the former `localStorage["mamago.selectedCity"]`. Safe to import on server and client.
 */
export const TERRITORY_COOKIE_NAME = "mg_territory";
export const TERRITORY_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const TERRITORY_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeTerritorySlug(value: string | null | undefined): string | null {
  const slug = value?.trim().toLowerCase();
  return slug && slug.length <= 80 && TERRITORY_SLUG_RE.test(slug) ? slug : null;
}

export function serializeTerritoryCookie(slug: string): string {
  const safe = normalizeTerritorySlug(slug);
  if (!safe) throw new Error(`Invalid territory slug: ${slug}`);
  return `${TERRITORY_COOKIE_NAME}=${safe}; Path=/; Max-Age=${TERRITORY_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

/** Reads the slug out of a raw `Cookie` header / `document.cookie` string. */
export function parseTerritoryCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === TERRITORY_COOKIE_NAME) return normalizeTerritorySlug(decodeURIComponent(rest.join("=")));
  }
  return null;
}

export function readTerritoryCookieClient(): string | null {
  if (typeof document === "undefined") return null;
  try {
    return parseTerritoryCookie(document.cookie);
  } catch {
    return null;
  }
}

export function writeTerritoryCookieClient(slug: string): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = serializeTerritoryCookie(slug);
  } catch {
    /* invalid slug or cookies disabled */
  }
}
