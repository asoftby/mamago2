export type HomeStoryPolicyItem = {
  id: string;
  sourceType: "EVENT" | "OFFER";
  placementType: "AUTO" | "FORCE_INCLUDE" | "EXCLUDE";
  status: "ACTIVE" | "INACTIVE";
  displayFrom: Date | null;
  displayUntil: Date | null;
};

/** Offers are deliberately absent from AUTO eligibility. */
export function isPublicHomeStoryItem(item: HomeStoryPolicyItem, now: Date): boolean {
  if (item.status !== "ACTIVE" || item.placementType === "EXCLUDE") return false;
  if (item.sourceType === "OFFER" && item.placementType !== "FORCE_INCLUDE") return false;
  if (item.displayFrom && item.displayFrom > now) return false;
  if (item.displayUntil && item.displayUntil <= now) return false;
  return true;
}

export function stableHomeStoryIdentity(item: Pick<HomeStoryPolicyItem, "id">): string {
  return item.id;
}
