import type { AgePolicy } from "@prisma/client";
export type Compatibility = "MATCH" | "MISMATCH" | "UNKNOWN";
export function birthdayAgeCompatibility(offer: { agePolicy: AgePolicy; ageMinMonths: number | null; ageMaxMonths: number | null }, age: { min: number; max: number } | undefined, audience: "ADULT" | "CHILD" | "UNKNOWN"): Compatibility {
  if (offer.agePolicy === "ADULT_ONLY") {
    if (age) return age.max < 216 ? "MISMATCH" : age.min >= 216 ? "MATCH" : "UNKNOWN";
    return audience === "CHILD" ? "MISMATCH" : audience === "ADULT" ? "MATCH" : "UNKNOWN";
  }
  if (offer.agePolicy === "UNRESTRICTED") return "MATCH";
  if (offer.agePolicy === "UNKNOWN") return "UNKNOWN";
  if (!age) {
    if (audience === "ADULT" && offer.ageMaxMonths !== null && offer.ageMaxMonths < 216) return "MISMATCH";
    if (audience === "CHILD" && offer.ageMinMonths !== null && offer.ageMinMonths >= 216) return "MISMATCH";
    return "UNKNOWN";
  }
  if ((offer.ageMinMonths !== null && age.max < offer.ageMinMonths) || (offer.ageMaxMonths !== null && age.min > offer.ageMaxMonths)) return "MISMATCH";
  return (offer.ageMinMonths === null || age.min >= offer.ageMinMonths) && (offer.ageMaxMonths === null || age.max <= offer.ageMaxMonths) ? "MATCH" : "UNKNOWN";
}
export function birthdayParticipantsCompatibility(offer: { minChildren: number | null; maxChildren: number | null; totalCapacity?: number | null }, guests: { childrenMin: number | null; childrenMax: number | null; total?: number }): Compatibility {
  if (guests.childrenMax !== null && offer.minChildren !== null && guests.childrenMax < offer.minChildren || guests.childrenMin !== null && offer.maxChildren !== null && guests.childrenMin > offer.maxChildren || guests.total !== undefined && offer.totalCapacity != null && guests.total > offer.totalCapacity) return "MISMATCH";
  return offer.minChildren !== null || offer.maxChildren !== null || offer.totalCapacity != null ? "MATCH" : "UNKNOWN";
}
/** One approved soft budget tolerance; changing it never changes hard eligibility. */
export const BIRTHDAY_MATCHING_CONFIG = { budgetSoftOverrunPct: 10 } as const;

export function birthdayLocationCompatibility(offer: { productType?: string | null; category?: string | null; locationType: string | null }, mode: "VENUE" | "PACKAGE" | "HOME" | "OUTDOOR" | null): Compatibility {
  if (offer.productType === "PARTY_SERVICE" && ["CAKE", "FOOD", "DECOR"].includes(offer.category ?? "")) return "MATCH";
  if (!mode || !offer.locationType) return "UNKNOWN";
  if ((mode === "HOME" || mode === "OUTDOOR") && offer.locationType === "ON_SITE") return "MISMATCH";
  return "MATCH";
}
