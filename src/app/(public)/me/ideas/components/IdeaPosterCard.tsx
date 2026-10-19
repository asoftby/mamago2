"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import { normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { formatRuShortDayMonthRange } from "@/lib/formatters/date";
import { formatPrice, formatPriceFrom } from "@/lib/formatters/format-price";
import { ageBoundsFromActivityFields } from "@/lib/event/activityAgeBounds";
import type { IdeaItem } from "../types";


type IdeaPosterCardProps = {
  idea: IdeaItem;
  isScheduling: boolean;
  isRemoving: boolean;
  onSchedule: () => void;
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
  isScheduling,
  isRemoving,
  onSchedule,
}: IdeaPosterCardProps) {
  const activity = idea.activity;
  const href = activity.publicHref ?? "#";
  const isPastEvent = idea.ideaType === "ACTIVITY" && activity.temporalState === "PAST";

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
    <article className="group min-w-0 break-inside-avoid">
      <div className="relative">
        <Link
          href={href}
          aria-disabled={isPastEvent}
          tabIndex={isPastEvent ? -1 : undefined}
          onClick={isPastEvent ? (event) => event.preventDefault() : undefined}
          className={cn(
            "block rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            isPastEvent && "pointer-events-none cursor-default grayscale opacity-55",
          )}
        >
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[18px] bg-surface-muted">
            {activity.coverImageUrl ? (
              // Cover the entire card across responsive column widths; avoid side gutters
              // caused by object-contain when posters hit a max-height constraint.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activity.coverImageUrl}
                alt={activity.title}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-surface-muted to-border" aria-hidden="true" />
            )}
            {priceLabel && (
              <span className="absolute bottom-3 right-3 inline-flex h-7 items-center rounded-full bg-foreground/75 px-3 font-mono text-[11px] text-background">
                {renderCurrencyText(normalizeUiCurrencyText(priceLabel), { iconSize: "sm" })}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-1 px-0.5">
            {categoryLabel && (
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {categoryLabel}
              </span>
            )}
            <span className={cn(
              "line-clamp-2 text-[15px] font-semibold leading-[1.3] tracking-[-0.01em]",
              isPastEvent ? "text-muted-foreground" : "text-foreground group-hover:text-primary",
            )}>
              {activity.title}
            </span>
            {metaLine && <span className="font-mono text-xs text-muted-foreground">{metaLine}</span>}
            {idea.isPlanned && <span className="text-xs font-medium text-muted-foreground">В плане</span>}
            {isPastEvent && <span className="text-xs font-medium text-muted-foreground">Уже прошло</span>}
          </div>
        </Link>
        <button
          type="button"
          onClick={onSchedule}
          disabled={isScheduling || isRemoving}
          aria-label="Изменить сохранение в плане или коллекции"
          title="Изменить сохранение"
          className="absolute right-3 top-3 z-10 flex size-11 items-center justify-center rounded-full bg-[rgba(250,247,241,0.82)] text-primary shadow-[0_1px_4px_rgba(20,18,16,0.10)] backdrop-blur-[6px] transition-transform hover:scale-105 active:scale-95 disabled:opacity-60 sm:size-8"
        >
          <Heart className="size-5 fill-current sm:size-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
