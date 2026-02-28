export type Intent = "kuda" | "classes" | "birthday" | "journal";

export interface IntentItem {
  id: Intent;
  label: string;
  href: (city: string) => string;
}

export const INTENT_ITEMS: IntentItem[] = [
  {
    id: "kuda",
    label: "Куда пойти",
    href: (city) => `/${city}`,
  },
  {
    id: "classes",
    label: "Занятия",
    href: (city) => `/${city}/classes`,
  },
  {
    id: "birthday",
    label: "ДР",
    href: (city) => `/${city}/birthday`,
  },
  {
    id: "journal",
    label: "Журнал",
    href: (city) => `/${city}/journal`,
  },
];

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
  if (potentialIntent === "journal") return "journal";
  
  return "kuda";
}

export function getCityFromPath(pathname: string | null): string {
  if (!pathname) return "minsk";
  const segments = pathname.split('/').filter(Boolean);
  return segments[0] || "minsk";
}
