import type { Occasion, OccasionType, Prisma } from "@prisma/client";

/**
 * Only calendar-based occasions are public filters in the «Куда пойти» catalog.
 * FAMILY (e.g. evergreen birthday) remains available to editors and celebrations
 * but must never become a global seasonal chip or selectable event facet.
 */
export const PUBLIC_DISCOVERY_OCCASION_TYPES: OccasionType[] = ["HOLIDAY", "SEASON", "EVENT"];

export function publicDiscoveryOccasionWhere(now: Date): Prisma.OccasionWhereInput {
  return {
    ...activeOccasionWhere(now),
    type: { in: PUBLIC_DISCOVERY_OCCASION_TYPES },
  };
}

/** A single admin-owned visibility window for every public occasion surface. */
export function activeOccasionWhere(now: Date): Prisma.OccasionWhereInput {
  return {
    isActive: true,
    startsAt: { lte: now },
    endsAt: { gte: now },
  };
}

/** Both dates are required; the configured end date is inclusive. */
export function isOccasionWithinActiveWindow(
  occasion: Pick<Occasion, "isActive" | "startsAt" | "endsAt"> | null,
  now: Date = new Date(),
): boolean {
  return Boolean(
    occasion?.isActive &&
    occasion.startsAt &&
    occasion.endsAt &&
    occasion.startsAt <= now &&
    now <= occasion.endsAt,
  );
}

/** The editor additionally honors autoSuggest; public filtering does not. */
export function isOccasionCurrentlyActive(
  occasion: Pick<Occasion, "isActive" | "autoSuggest" | "startsAt" | "endsAt">,
  now: Date = new Date(),
): boolean {
  return occasion.autoSuggest && isOccasionWithinActiveWindow(occasion, now);
}
