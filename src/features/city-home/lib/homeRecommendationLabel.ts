import type { HomeFamilyContext } from "./familyHome";
import { familyFitBadgeLabel } from "@/lib/family/fitBadgeLabel";

/** Family-event matching is supplied by the event feed; only presentation is shared. */
export function homeRecommendationLabel(
  item: { agePolicy: string; ageMinMonths: number | null; ageMaxMonths: number | null; matchedChildIds: string[]; matchBadgeChildIds?: string[] },
  context: Pick<HomeFamilyContext, "children">,
): string | null {
  // A missing evidence field means legacy/age-only payload: no badge.
  if (!item.matchBadgeChildIds?.length) return null;
  const children = context.children.filter(child => item.matchBadgeChildIds!.includes(child.id));
  // Adult relevance requires independent evidence; age allowance is insufficient.
  return familyFitBadgeLabel({
    matchedChildNames: children.map(child => child.name?.trim() || ""),
    allowsAdults: false,
  });
}
