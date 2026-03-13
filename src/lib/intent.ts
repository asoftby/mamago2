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

export function getIntentFromPath(pathname: string | null): Intent | null {
  if (!pathname) return null;
  
  // Extract segments: /city/intent
  const segments = pathname.split('/').filter(Boolean);
  
  // Need at least city segment
  if (segments.length < 1) return null;
  
  // If only city (e.g., /minsk), it's "kuda"
  if (segments.length === 1) return "kuda";
  
  // If more than 2 segments (e.g., /minsk/activity/123), it's a detail page, not a discovery page
  if (segments.length > 2) return null;
  
  // Check second segment for valid intents
  const potentialIntent = segments[1];
  
  if (potentialIntent === "classes") return "classes";
  if (potentialIntent === "birthday") return "birthday";
  if (potentialIntent === "routes") return "routes";
  
  // If second segment exists but is not a valid intent, return null
  // This handles cases like /minsk/activity, /minsk/places, etc.
  return null;
}

// List of valid city slugs
// TODO: Consider fetching this dynamically or from a config file
const VALID_CITY_SLUGS = ["minsk"];

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
  
  // Check if first segment is a valid city slug
  if (VALID_CITY_SLUGS.includes(firstSegment)) {
    return firstSegment;
  }
  
  // Unknown segment - could be a new city or invalid route
  // Return null to be safe
  return null;
}
