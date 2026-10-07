/** Marker owner: `family` for items without a child, else the child id. */
export type PlanDayMarkerOwner = "family" | string;

export function buildPlanDayMarkers(
  items: ReadonlyArray<{ date: string; childId: string | null }>,
): Record<string, PlanDayMarkerOwner[]> {
  const byDate: Record<string, PlanDayMarkerOwner[]> = {};
  for (const item of items) {
    const owner = item.childId ?? "family";
    const owners = (byDate[item.date] ??= []);
    if (!owners.includes(owner)) owners.push(owner);
  }
  return byDate;
}
