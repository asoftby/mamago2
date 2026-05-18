import { formatRuShortDayMonth } from "@/lib/formatters/date";
import {
  mapEventToActivityCardItem,
  mapOfferToActivityCardItem,
  type ActivityCardItem,
} from "@/features/activities";
import type { IdeaItem } from "./types";

function formatRouteDateLabel(plannedDate?: string): string | null {
  if (!plannedDate) return null;
  return `На ${formatRuShortDayMonth(plannedDate)}`;
}

export function mapSavedIdeaToActivityCardItem(idea: IdeaItem): ActivityCardItem {
  if (idea.ideaType === "ACTIVITY") {
    return mapEventToActivityCardItem({
      ...idea.activity,
      href: idea.activity.publicHref ?? "#",
      imageUrl: idea.activity.coverImageUrl ?? null,
      isSaved: true,
      isPlanned: idea.isPlanned,
    });
  }

  if (idea.ideaType === "OFFER") {
    const mapped = mapOfferToActivityCardItem({
      ...idea.activity,
      href: idea.activity.publicHref ?? "#",
      imageUrl: idea.activity.coverImageUrl ?? null,
      isSaved: true,
      isPlanned: idea.isPlanned,
    });

    return {
      ...mapped,
      ageLabel: idea.activity.dateLabel ? null : mapped.ageLabel,
    };
  }

  return {
    id: idea.activity.id,
    type: "event",
    title: idea.activity.title,
    href: idea.activity.publicHref ?? "#",
    imageUrl: idea.activity.coverImageUrl ?? null,
    badgeLabel: "Маршрут",
    dateLabel: formatRouteDateLabel(idea.plannedDate),
    placeTitle: idea.activity.placeTitle ?? null,
    addressLabel: idea.activity.addressLabel ?? null,
    priceLabel: null,
    ageLabel: null,
    categoryLabel: "Семейная прогулка",
    isSaved: true,
    isPlanned: idea.isPlanned,
    isPast: false,
    statusLabel: null,
  };
}
