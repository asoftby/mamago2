export type PlanActivityPublicAvailability =
  | "ok"
  | "business_disabled"
  | "missing_activity";

export function getPlanActivityPublicAvailability(
  activity: {
    status: string;
    owner: { business: { operationalStatus: string } | null } | null;
  } | null
): PlanActivityPublicAvailability {
  if (!activity) return "missing_activity";
  if (activity.status !== "PUBLISHED") return "ok";
  const b = activity.owner?.business;
  if (!b) return "ok";
  return b.operationalStatus === "ACTIVE" ? "ok" : "business_disabled";
}

export function isPlacePubliclyVisible(place: {
  status: string;
  archivedAt: Date | null;
  owner: { business: { operationalStatus: string } | null } | null;
}): boolean {
  if (place.status !== "PUBLISHED" || place.archivedAt) return false;
  const biz = place.owner?.business;
  if (!biz) return true;
  return biz.operationalStatus === "ACTIVE";
}
