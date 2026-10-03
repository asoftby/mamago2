import { SYSTEM_INTERESTS } from "@/lib/config/interests";

export const CANONICAL_EVENT_INTEREST_SLUGS = new Set(
  SYSTEM_INTERESTS.map((interest) => interest.slug),
);

export function canonicalSystemInterestSlugs(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter(
    (value): value is string =>
      typeof value === "string" && CANONICAL_EVENT_INTEREST_SLUGS.has(value),
  ))].slice(0, SYSTEM_INTERESTS.length);
}

export function eventSystemInterestSlugs(scheduleJson: unknown): string[] {
  if (!scheduleJson || typeof scheduleJson !== "object" || Array.isArray(scheduleJson)) return [];
  const signals = (scheduleJson as Record<string, unknown>).signals;
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) return [];
  return canonicalSystemInterestSlugs((signals as Record<string, unknown>).interests);
}
