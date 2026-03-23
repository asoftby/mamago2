import { DISCOVERY_INTENT_CONFIG, DISCOVERY_INTENT_ITEMS } from "@/lib/discovery/discoveryIntentConfig";

export type Intent = "kuda" | "classes" | "birthday" | "routes";

export interface IntentItem {
  id: Intent;
  label: string;
  href: (city: string) => string;
}

// Export the intent items from the centralized config
export const INTENT_ITEMS: IntentItem[] = DISCOVERY_INTENT_ITEMS.map(config => ({
  id: config.id,
  label: config.label,
  href: config.href,
}));

/** Список городов с городским хабом `/{city}` */
export const VALID_CITY_SLUGS = ["minsk"] as const;

export type CitySlug = (typeof VALID_CITY_SLUGS)[number];

export function isCityHubPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 1 && VALID_CITY_SLUGS.includes(segments[0] as CitySlug);
}

export function getIntentFromPath(pathname: string | null): Intent | null {
  if (!pathname) return null;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 1) return null;

  /** Односегментные пути: хаб города, блог, landing — не вкладка discovery */
  if (segments.length === 1) {
    return null;
  }

  /** Детальные страницы /city/activity/id и т.д. */
  if (segments.length > 2) return null;

  const potentialIntent = segments[1];

  if (potentialIntent === "kuda") return "kuda";
  if (potentialIntent === "classes") return "classes";
  if (potentialIntent === "birthday") return "birthday";
  if (potentialIntent === "routes") return "routes";

  return null;
}

// List of known non-city route prefixes
const NON_CITY_ROUTES = [
  "me",
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "places",
  "ui-test",
  "account",
  "admin",
  "business",
  "api",
  "_next",
];

export function getCityFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];
  
  if (!firstSegment) return null;
  
  // Check if first segment is a known non-city route
  if (NON_CITY_ROUTES.includes(firstSegment)) {
    return null;
  }
  
  if ((VALID_CITY_SLUGS as readonly string[]).includes(firstSegment)) {
    return firstSegment;
  }
  
  // Unknown segment - could be a new city or invalid route
  // Return null to be safe
  return null;
}
