import { resolveRouteCitySlug } from "@/lib/city/resolveCityContext";

const LISTING_SECTIONS = new Set([
  "events",
  "classes",
  "places",
  "offers",
  "routes",
  "birthday",
]);

const EXCLUDED_ROOT_SEGMENTS = new Set([
  "admin",
  "business",
  "editor",
  "plan",
  "ideas",
  "collections",
  "profile",
  "profile-entry",
  "settings",
  "login",
  "register",
  "about",
  "support",
  "legal",
  "page",
  "me",
]);

const LISTING_SUBPAGE_ALLOWLIST: Record<string, Set<string>> = {
  events: new Set(["today", "tomorrow", "weekend"]),
  classes: new Set(),
  places: new Set(["cafes"]),
  offers: new Set(),
  routes: new Set(),
  birthday: new Set(),
};

function normalizePathname(pathname: string): string {
  const [pathWithoutHash] = pathname.split("#");
  const [pathWithoutQuery] = pathWithoutHash.split("?");
  const normalized = pathWithoutQuery.trim();

  if (!normalized) return "/";
  if (normalized === "/") return normalized;

  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

/**
 * Desktop header search is shown only on public city listing surfaces.
 * Detail pages stay excluded unless a nested path is explicitly known as a
 * listing subpage. This keeps the rule conservative and avoids leaking the
 * heavy search row into backoffice, auth, marketing, and content detail pages.
 */
export function shouldShowDesktopHeaderSearch(pathname: string): boolean {
  const normalizedPathname = normalizePathname(pathname);
  const segments = normalizedPathname.split("/").filter(Boolean);

  if (segments.length === 0) return false;

  const rootSegment = segments[0]?.toLowerCase();
  if (!rootSegment || EXCLUDED_ROOT_SEGMENTS.has(rootSegment)) return false;

  const citySlug = resolveRouteCitySlug(normalizedPathname);
  if (!citySlug) return false;

  if (segments.length === 1) return true;

  const section = segments[1]?.toLowerCase();
  if (!section || !LISTING_SECTIONS.has(section)) return false;

  if (segments.length === 2) return true;

  if (segments.length > 3) return false;

  const nestedSlug = segments[2]?.toLowerCase();
  if (!nestedSlug) return false;

  return LISTING_SUBPAGE_ALLOWLIST[section]?.has(nestedSlug) ?? false;
}
