import { AGE_OPTIONS } from "@/lib/config/ages";
import type { PersonalShowWindow } from "@/server/services/recommendations/familyPicks/window";

export function homeFamilyPicksEnabled(env: Record<string, string | undefined> = process.env) {
  return env.HOME_FAMILY_PICKS_V2 === "1";
}
export type HomeFamilyContext = {
  actorId: string | null;
  signature: string;
  day: string;
  policyVersion: string;
  audience: "guest" | "no_child_with_DOB" | "personalized";
  children: { id: string; name: string | null; hasBirthDate: boolean; ageYears?: number | null; ageFilter: string[] }[];
  selectedChildId: string | null;
  preferenceVersion: string | null;
  selectionPersistence: "account" | "device";
};
export function homeSelection(context: HomeFamilyContext, requested: string | null) {
  return requested && context.children.some(child => child.id === requested) ? requested : null;
}
export function homeCatalogHref(city: string, context: HomeFamilyContext, selected: string | null) {
  const keys = new Set(context.children.filter(child => !selected || child.id === selected).flatMap(child => child.ageFilter));
  const age = AGE_OPTIONS.filter(option => keys.has(option.key)).map(option => option.key);
  const params = new URLSearchParams();
  if (age.length) params.set("age", age.join(","));
  return `/${city}/events${age.length ? `?${params}` : ""}`;
}
export function homeSelectionLabel(context: HomeFamilyContext, selected: string | null) {
  return selected ? context.children.find(child => child.id === selected)?.name?.trim() || "ребёнка" : "всей семьи";
}
export function homeAgeLabel(input: { agePolicy: string; ageMinMonths: number | null; ageMaxMonths: number | null }) {
  if (input.agePolicy === "UNRESTRICTED") return "Для всех возрастов";
  const min = input.ageMinMonths, max = input.ageMaxMonths;
  const age = (months: number) => months % 12 === 0 ? String(months / 12) : `${months} мес.`;
  if (min != null && max != null) return min === max ? age(min) : `${age(min)}–${age(max)}`;
  if (min != null) return `${age(min)}+`;
  if (max != null) return `До ${age(max)}`;
  return "Возраст уточняется";
}
export function homePeriodLabel(window: PersonalShowWindow) {
  return window.horizonDays === 30 ? "На ближайшие 30 дней" : "На ближайшие 7 дней";
}
export function minskPlanDate(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Minsk", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function familyHomeCacheKey(context: HomeFamilyContext, city: string, selected: string | null, windowDays: 7 | 30) {
  return JSON.stringify([context.actorId, context.signature, city, selected, context.policyVersion, context.day, windowDays]);
}
