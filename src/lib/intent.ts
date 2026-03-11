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

export function getIntentFromPath(pathname: string | null): Intent {
  if (!pathname) return "kuda";
  
  // Extract segments: /city/intent
  const segments = pathname.split('/').filter(Boolean);
  // segments[0] is city
  // segments[1] is intent (or undefined for 'kuda')
  
  if (segments.length < 2) return "kuda";
  
  const potentialIntent = segments[1];
  
  if (potentialIntent === "classes") return "classes";
  if (potentialIntent === "birthday") return "birthday";
  if (potentialIntent === "routes") return "routes";
  
  return "kuda";
}

export function getCityFromPath(pathname: string | null): string {
  if (!pathname) return "minsk";
  const segments = pathname.split('/').filter(Boolean);
  return segments[0] || "minsk";
}
