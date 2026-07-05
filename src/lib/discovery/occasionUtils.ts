import type { Occasion } from "@prisma/client";

/**
 * Returns true if the occasion is currently active as a contextual signal:
 * - isActive must be true
 * - autoSuggest must be true
 * - startsAt and endsAt must both be set
 * - now must be within [startsAt, endsAt]
 */
export function isOccasionCurrentlyActive(
  occasion: Pick<Occasion, "isActive" | "autoSuggest" | "startsAt" | "endsAt">,
  now: Date = new Date(),
): boolean {
  if (!occasion.isActive) return false;
  if (!occasion.autoSuggest) return false;
  if (!occasion.startsAt || !occasion.endsAt) return false;
  return now >= occasion.startsAt && now <= occasion.endsAt;
}
