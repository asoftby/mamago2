import type { MyPlanIdea } from "../hooks/useMyPlan";

type Activity = NonNullable<MyPlanIdea["activity"]>;

export function normalizePlanSuggestions(
  fromApi: Activity[],
  maxItems = 5,
): Activity[] {
  const seen = new Set<string>();
  const deduped: Activity[] = [];
  for (const activity of fromApi) {
    if (seen.has(activity.id)) continue;
    seen.add(activity.id);
    deduped.push(activity);
    if (deduped.length >= maxItems) break;
  }
  return deduped;
}
