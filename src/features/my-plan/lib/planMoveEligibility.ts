import type { PlanItemWithActivity } from "../types/event";

type Candidate = Pick<PlanItemWithActivity, "source" | "activityId" | "routeId" | "planRouteSlug" | "placeId" | "planPlaceSlug" | "articleId"> &
  Partial<Pick<PlanItemWithActivity, "offerId">>;

/**
 * Which cards get «Перенести»: an event (its sessions), a note (any date; a Telegram one is a note too), and an entry
 * that points at a place, an offer or a route (any date, same time of day). Not an article.
 */
export function canMovePlanItem(item: Candidate): boolean {
  if (item.articleId) return false;
  if (item.routeId || item.planRouteSlug || item.placeId || item.planPlaceSlug || item.offerId) return true;
  if (item.source === "MANUAL" || item.source === "TELEGRAM_FORWARD") return true;
  return Boolean(item.activityId);
}

/** A place / offer / route entry: moved by date only, through PATCH /api/plan/items/:id/date. */
export function isLinkedEntityMove(item: Candidate): boolean {
  return !item.activityId && !item.articleId && Boolean(item.routeId || item.planRouteSlug || item.placeId || item.planPlaceSlug || item.offerId);
}
