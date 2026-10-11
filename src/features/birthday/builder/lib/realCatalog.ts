export type PartyCategoryKey = "VENUE" | "ANIMATOR" | "SHOW" | "MASTER_CLASS" | "CAKE" | "FOOD" | "DECOR" | "PHOTO" | "PROGRAM" | "OTHER";
export type BirthdayCatalogItem = {
  id: string;
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
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  minChildren: number | null;
  maxChildren: number | null;
  locationType: string | null;
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
    includedCategories: Array.from(new Set([...selected, ...mandatory])),
    prepaymentTerms: stringOrNull(d.prepaymentTerms),
    cancellationTerms: stringOrNull(d.cancellationTerms),
  };
}
export function matchesBirthdayRequirements(item: BirthdayCatalogItem, q: {
  ageMonths?: number | null; children?: number | null; maxBudget?: number | null;
}): boolean {
  if (q.ageMonths != null && (
    (item.ageMinMonths != null && q.ageMonths < item.ageMinMonths) ||
    (item.ageMaxMonths != null && q.ageMonths > item.ageMaxMonths)
  )) return false;
  if (q.children != null && (
    (item.minChildren != null && q.children < item.minChildren) ||
    (item.maxChildren != null && q.children > item.maxChildren)
  )) return false;
  if (q.maxBudget != null && item.priceFrom != null && item.priceFrom > q.maxBudget) return false;
  return true;
}
