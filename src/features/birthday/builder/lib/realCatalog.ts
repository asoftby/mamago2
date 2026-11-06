import type { AgePolicy } from "@prisma/client";
import { birthdayAgeCompatibility, birthdayParticipantsCompatibility } from "@/lib/birthday/compatibility";
export type PartyCategoryKey = "VENUE" | "ANIMATOR" | "SHOW" | "MASTER_CLASS" | "CAKE" | "FOOD" | "DECOR" | "PHOTO" | "PROGRAM" | "OTHER";
export type BirthdayCatalogItem = {
  id: string;
  slug?: string | null;
  title: string;
  productType: "PARTY_SERVICE" | "PARTY_PACKAGE";
  category: PartyCategoryKey | null;
  businessId: string;
  businessName: string;
  placeId: string;
  placeTitle: string;
  coverImage: string | null;
  priceFrom: number | null;
  priceMode: string;
  currency: string;
  agePolicy?: AgePolicy;
  interestSlugs?: string[];
  performerRole?: "HOST" | "ANIMATOR" | null;
  durationMinutes?: number | null;
  components?: { id: string; title: string; category: PartyCategoryKey; isOptional: boolean }[];
  priceResolution?: "RESOLVED" | "UNRESOLVED";
  geographyCompatibility?: "MATCH" | "UNKNOWN";
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  minChildren: number | null;
  maxChildren: number | null;
  locationType: "ON_SITE" | "OFF_SITE" | "BOTH" | null;
  includedCategories: PartyCategoryKey[];
  prepaymentTerms: string | null;
  cancellationTerms: string | null;
};
const categories = new Set<PartyCategoryKey>([
  "VENUE", "ANIMATOR", "SHOW", "MASTER_CLASS", "CAKE",
  "FOOD", "DECOR", "PHOTO", "PROGRAM", "OTHER",
]);
export function extractPartyDetails(details: unknown, components: readonly {
  category: PartyCategoryKey; isOptional: boolean;
}[]): Pick<BirthdayCatalogItem, "includedCategories" | "prepaymentTerms" | "cancellationTerms"> {
  const d = details && typeof details === "object" && !Array.isArray(details)
    ? details as Record<string, unknown> : {};
  const included = Array.isArray(d.includedCategories) ? d.includedCategories : [];
  const selected = included.filter((v): v is PartyCategoryKey =>
    typeof v === "string" && categories.has(v as PartyCategoryKey));
  const mandatory = components.filter((v) => !v.isOptional).map((v) => v.category);
  const stringOrNull = (v: unknown) => typeof v === "string" && v.trim() ? v.trim() : null;
  return {
    includedCategories: Array.from(new Set((components.length ? mandatory : selected))),
    prepaymentTerms: stringOrNull(d.prepaymentTerms),
    cancellationTerms: stringOrNull(d.cancellationTerms),
  };
}
export function matchesBirthdayRequirements(item: BirthdayCatalogItem, q: {
  ageMonths?: number | null; ageRangeMonths?: { min: number; max: number }; audience?: "ADULT" | "CHILD" | "UNKNOWN"; children?: number | null; maxBudget?: number | null;
  /** Guest group as a range; the offer is kept when its capacity overlaps it. */
  childrenMin?: number | null; childrenMax?: number | null;
}): boolean {
  const policy = item.agePolicy ?? (item.ageMinMonths !== null || item.ageMaxMonths !== null ? "SPECIFIC" : "UNKNOWN");
  if (birthdayAgeCompatibility({ agePolicy: policy, ageMinMonths: item.ageMinMonths, ageMaxMonths: item.ageMaxMonths },
    q.ageMonths != null ? { min: q.ageMonths, max: q.ageMonths } : q.ageRangeMonths, q.audience ?? "UNKNOWN") === "MISMATCH") return false;
  if (birthdayParticipantsCompatibility(item, { childrenMin: q.children ?? q.childrenMin ?? null, childrenMax: q.children ?? q.childrenMax ?? null }) === "MISMATCH") return false;
  // Budget is a soft ranking preference, not membership. Explicit UI price filters belong to their surface.

  return true;
}

/** ON_REQUEST / NONE / UNKNOWN keep a stale number in the DB; it must not surface as a price. */
export function publicPriceFrom(priceMode: string, priceFrom: number | null): number | null {
  if (priceMode === "FREE") return 0;
  if (priceMode === "ON_REQUEST" || priceMode === "NONE" || priceMode === "UNKNOWN") return null;
  return priceFrom !== null && Number.isFinite(priceFrom) && priceFrom >= 0 ? priceFrom : null;
}
