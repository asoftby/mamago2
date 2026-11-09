import type { PlanItemWithActivity } from "../types/event";

/** The catalog entity a plan entry points at; null = no link (a note). */
export type PlanItemLinkKind = "activity" | "place" | "offer" | "route" | "article";

type LinkFields = Partial<Pick<PlanItemWithActivity, "activityId" | "source" | "placeId" | "planPlaceSlug" | "offerId" | "routeId" | "planRouteSlug" | "articleId">> & {
    activity?: unknown;
    offer?: unknown;
  };

/**
 * What a card is: decided by the link to a catalog entity, never by who created the entry. A link (event, place,
 * offer, route, article) -> a catalog card: cover, short preview, move / delete. No link -> a note.
 */
export function planItemLinkKind(item: LinkFields): PlanItemLinkKind | null {
  if (item.activityId || item.activity) return "activity";
  if (item.articleId) return "article";
  if (item.placeId || item.planPlaceSlug) return "place";
  if (item.offerId || item.offer) return "offer";
  if (item.routeId || item.planRouteSlug) return "route";
  return null;
}

/** An unlinked entry the user can open and edit (own note or a Telegram-extracted one). */
export function isEditableNote(item: LinkFields): boolean {
  return planItemLinkKind(item) === null && (item.source === "MANUAL" || item.source === "TELEGRAM_FORWARD");
}
