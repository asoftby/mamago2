import type { PlanItemWithActivity } from "../types/event";

type Candidate = Pick<PlanItemWithActivity, "source" | "activityId" | "routeId" | "planRouteSlug" | "placeId" | "planPlaceSlug" | "articleId">;

/** A Telegram-extracted PlanItem is a freely reschedulable note, not a fixed catalog session. */
export function canMovePlanItem(item: Candidate): boolean {
  if (item.routeId || item.planRouteSlug || item.placeId || item.planPlaceSlug || item.articleId) return false;
  if (item.source === "MANUAL" || item.source === "TELEGRAM_FORWARD") return true;
  return Boolean(item.activityId);
}
