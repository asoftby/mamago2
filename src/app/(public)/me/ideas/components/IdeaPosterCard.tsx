"use client";

import { RouteCardVisual } from "@/components/routes/RouteCardVisual";
import { JournalCard } from "@/components/content-cards/JournalCard";
import { EventCard } from "@/components/events/EventCard";
import { OfferCard } from "@/components/offers/OfferCard";
import { formatRuShortDayMonthRange } from "@/lib/formatters/date";
import { formatPrice, formatPriceFrom } from "@/lib/formatters/format-price";
import { ageBoundsFromActivityFields } from "@/lib/event/activityAgeBounds";
import type { IdeaItem } from "../types";
import { IdeaCardActions } from "./IdeaCardActions";

type IdeaPosterCardProps = {
  idea: IdeaItem;
  compact?: boolean;
  unsorted?: boolean;
  isScheduling: boolean;
  isRemoving: boolean;
  onSchedule: () => void;
  onRemove: () => void;
  onCollection?: () => void;
};

/** Same "от X" vs "X" heuristic already duplicated in ActivityCard.tsx and page.tsx for discovery cards. */
function priceCaption(a: {
  priceFrom?: number | null;
  priceMax?: number | null;
  priceListUsesOt?: boolean | null;
}): string | null {
  if (a.priceFrom === 0) return "бесплатно";
  if (a.priceFrom == null) return null;
  const useOt =
    a.priceListUsesOt ?? !(a.priceMax != null && a.priceFrom === a.priceMax);
  return useOt ? formatPriceFrom(a.priceFrom) : formatPrice(a.priceFrom);
}

export function IdeaPosterCard({
  idea,
  compact = false,
  unsorted = false,
  isScheduling,
  isRemoving,
  onSchedule,
  onRemove,
  onCollection,
}: IdeaPosterCardProps) {
  const activity = idea.activity;
  const href = activity.publicHref ?? "#";
  const isPastEvent = idea.ideaType === "ACTIVITY" && activity.temporalState === "PAST";
  const isArticle = idea.ideaType === "ARTICLE";

  const ageBounds =
    idea.ideaType === "ACTIVITY"
      ? ageBoundsFromActivityFields({
          ageTags: activity.ageTags ?? [],
          ageMinMonths: activity.ageMinMonths,
          ageMaxMonths: activity.ageMaxMonths,
        })
      : null;
  const ageLabel = ageBounds?.ageFrom != null ? `${ageBounds.ageFrom}+` : null;

  const dateLabel =
    idea.ideaType === "ACTIVITY" && activity.dateStart
      ? formatRuShortDayMonthRange(activity.dateStart, activity.dateEnd ?? null)
      : idea.ideaType === "OFFER"
        ? (activity.dateLabel ?? null)
        : null;

  const priceLabel =
    idea.ideaType === "ACTIVITY"
      ? priceCaption({
          priceFrom: activity.priceFrom,
          priceMax: activity.priceMax,
          priceListUsesOt: activity.priceListUsesOt,
        })
      : idea.ideaType === "OFFER"
        ? (activity.priceText?.trim() || null)
        : null;

  const categoryLabel =
    idea.ideaType === "ROUTE"
      ? "маршрут"
      : idea.ideaType === "ARTICLE"
        ? (activity.categoryLabel ?? "статья")
        : (activity.categoryLabel ?? null);

  const metaLine = [ageLabel, dateLabel].filter(Boolean).join(" · ");

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-3">
      {idea.ideaType === "ACTIVITY" ? (
        <EventCard id={activity.id} title={activity.title} href={href}
          imageUrl={activity.coverImageUrl} categoryLabel={categoryLabel ?? undefined}
          metaLabel={metaLine} priceLabel={priceLabel ?? undefined} />
      ) : idea.ideaType === "ROUTE" ? (
        <div className="group relative"><RouteCardVisual href={href} title={activity.title} imageUrl={activity.coverImageUrl} meta={activity.ageLabel ?? undefined} /></div>
      ) : isArticle ? (
        <JournalCard href={href} title={activity.title} imageUrl={activity.coverImageUrl} categoryLabel={categoryLabel} />
      ) : (
        <OfferCard id={activity.id} title={activity.title} href={href}
          imageUrl={activity.coverImageUrl} categoryLabel={categoryLabel ?? undefined}
          dateLabel={dateLabel ?? undefined} priceLabel={priceLabel ?? undefined} hideSave />
      )}
      {!unsorted && idea.isPlanned && <span className="text-xs font-medium text-stone-500">В плане</span>}
      {!unsorted && isPastEvent && <span className="text-xs text-stone-500">Уже прошло</span>}
      <IdeaCardActions compact={compact} unsorted={unsorted} isPlanned={idea.isPlanned} isPast={isPastEvent} canSchedule={!isArticle}
        publicHref={activity.publicHref ?? null} onSchedule={onSchedule} onRemove={onRemove}
        onCollection={onCollection} isScheduling={isScheduling} isRemoving={isRemoving} />
    </div>
  );
}
