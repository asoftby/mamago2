import type { PlanItemWithActivity } from "../types/event";
import { publicActivityPath } from "@/lib/business/eventPublicLink";

export const MY_PLAN_FULL_PAGE_HREF = "/me/plan";

export function upcomingPlanItemHref(item: PlanItemWithActivity): string | null {
  if (item.activity) {
    return publicActivityPath(item.activity.id, "minsk", item.activity.slug);
  }
  if (item.planRouteSlug) return `/routes/${item.planRouteSlug}`;
  if (item.planPlaceSlug) return `/places/${item.planPlaceSlug}`;
  return null;
}

export type UpcomingPlanSelection = {
  date: string;
  count: number;
  items: PlanItemWithActivity[];
} | null;

export function selectUpcomingPlanItems(input: {
  selectedDate: string;
  todayIso: string;
  selectedDateItems: PlanItemWithActivity[];
  nearestDate: string | null;
  nearestCount: number;
  nearestItems: PlanItemWithActivity[];
  now?: Date;
}): UpcomingPlanSelection {
  const now = input.now ?? new Date();
  const selectedFutureItems = input.selectedDateItems.filter(
    (item) =>
      item.date > input.todayIso ||
      (item.date === input.todayIso &&
        (item.startsAt == null || new Date(item.startsAt).getTime() >= now.getTime())),
  );
  if (selectedFutureItems.length > 0) {
    return {
      date: input.selectedDate,
      count: selectedFutureItems.length,
      items: selectedFutureItems.slice(0, 2),
    };
  }
  if (!input.nearestDate || input.nearestDate < input.todayIso || input.nearestCount < 1) {
    return null;
  }
  return {
    date: input.nearestDate,
    count: input.nearestCount,
    items: input.nearestItems.slice(0, 2),
  };
}
