"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { MapPin, Navigation } from "lucide-react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EventPageData } from "@/lib/event/eventPageTypes";
import { EventBreadcrumbs } from "./EventBreadcrumbs";
import { EventFactsChips } from "./EventFactsChips";
import { EventVenueLocationRows } from "./EventVenueLocationRows";
import { OwnerEditDropdown } from "./OwnerEditDropdown";

/** Возраст: рядом с категорией, только текст, чёрный. */
const decisionHeroAgeTextClass =
  "inline-flex items-center text-[15px] font-medium uppercase tracking-[0.04em] tabular-nums text-neutral-950";

/** Персиковый pill категории в шапке решения. */
const decisionHeroCategoryPillClass =
  "inline-flex w-fit items-center rounded-full border border-[#F2B39A] bg-[#FFF7F3] px-4 pt-[6px] pb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#F07F55] tabular-nums";

type EventDecisionPanelProps = {
  data: Pick<
    EventPageData,
    | "id"
    | "breadcrumbs"
    | "ageFromBadge"
    | "categoryLabel"
    | "title"
    | "factChips"
    | "priceLabel"
    | "venue"
    | "cta"
    | "ownerEditHref"
  >;
  sessionLine?: string;
  venueShort?: string;
  onPlan: () => void;
  onBuy: () => void;
  onSave: () => void;
  /** Событие уже в плане */
  isPlanned?: boolean;
  /** Дата в плане (ISO) для отображения в кнопке */
  planDate?: string | null;
  className?: string;
  /** Классы для мягкой подсветки зон после сохранения из редактора */
  previewRegionClassName?: Partial<
    Record<"hero" | "venue" | "schedule" | "pricing", string | undefined>
  >;
};

export function EventDecisionPanel({
  data,
  sessionLine,
  venueShort,
  onPlan,
  onBuy,
  onSave,
  isPlanned = false,
  planDate,
  className,
  previewRegionClassName,
}: EventDecisionPanelProps) {
  const pr = previewRegionClassName;

  const planLabel = isPlanned
    ? planDate
      ? `В плане на ${new Date(`${planDate}T12:00:00`).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}`
      : "В плане ✓"
    : data.cta.planLabel;
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div className={cn("-m-1 space-y-4 rounded-2xl p-1", pr?.hero)}>
        <EventBreadcrumbs items={data.breadcrumbs} />

        {(data.ageFromBadge || data.categoryLabel) && (
          <div className="flex flex-wrap items-center gap-2">
            {data.ageFromBadge ? (
              <span className={decisionHeroAgeTextClass}>{data.ageFromBadge}</span>
            ) : null}
            {data.categoryLabel ? (
              <span className={decisionHeroCategoryPillClass}>{data.categoryLabel}</span>
            ) : null}
          </div>
        )}

        <h1 className="text-balance text-[28px] font-semibold leading-tight tracking-tight text-foreground sm:text-[32px] lg:text-[34px]">
          {data.title}
        </h1>

        <EventFactsChips chips={data.factChips} />
      </div>

      <div className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-4 shadow-sm">
        {sessionLine && (
          <div className={cn(pr?.schedule)}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Ближайшее время
            </p>
            <p className="mt-1 text-[15px] font-medium text-foreground">
              {sessionLine}
            </p>
          </div>
        )}

        {(data.venue || venueShort) && (
          <div
            className={cn(
              "space-y-3",
              pr?.venue,
              sessionLine && "border-t border-border/50 pt-4"
            )}
          >
            <div className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Где
                </p>
                {data.venue?.placeHref ? (
                  <Link
                    href={data.venue.placeHref}
                    className="mt-0.5 block text-[15px] font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {data.venue.name ?? venueShort}
                  </Link>
                ) : (
                  <p className="mt-0.5 text-[15px] font-medium text-foreground">
                    {data.venue?.name ?? venueShort}
                  </p>
                )}
                {data.venue ? (
                  <EventVenueLocationRows
                    venue={data.venue}
                    variant="compact"
                    className="mt-1.5"
                  />
                ) : null}
              </div>
            </div>
            {!data.venue && venueShort && (
              <p className="text-[13px] text-muted-foreground pl-6">{venueShort}</p>
            )}
            {(data.venue?.routeUrl || data.venue?.mapUrl || data.venue?.landmark) && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {data.venue?.routeUrl || data.venue?.mapUrl ? (
                  <Button variant="outline" size="sm" className="h-8 rounded-xl" asChild>
                    <a
                      href={data.venue?.routeUrl ?? data.venue?.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Navigation className="size-4" />
                      Маршрут
                    </a>
                  </Button>
                ) : null}
                {data.venue?.landmark ? (
                  <p className="text-[12px] text-muted-foreground">
                    {data.venue.landmark}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        )}

        <div
          className={cn(
            "flex flex-wrap items-end justify-between gap-3 border-t border-border/50 pt-4",
            pr?.pricing
          )}
        >
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Стоимость
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {data.priceLabel}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {isPlanned ? (
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-12 min-h-[48px] w-full rounded-2xl px-6 text-[15px] font-semibold sm:w-auto sm:min-w-[160px]",
              "gap-2 border-[#EF8759] bg-[#FFF7F3] text-[#EF8759] hover:bg-[#FFF0E8]",
            )}
            onClick={onPlan}
          >
            <Check className="h-4 w-4 shrink-0" />
            {planLabel}
          </Button>
        ) : (
          <PrimaryButton
            type="button"
            className="h-12 min-h-[48px] w-full rounded-2xl px-6 text-[15px] sm:w-auto sm:min-w-[160px]"
            onClick={onPlan}
          >
            {planLabel}
          </PrimaryButton>
        )}
        {data.cta.purchaseUrl ? (
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-2xl border-border/80 px-6 text-[15px] font-semibold sm:w-auto sm:min-w-[160px]"
            onClick={onBuy}
          >
            {data.cta.buyLabel}
          </Button>
        ) : null}
        {data.ownerEditHref ? (
          <OwnerEditDropdown
            eventId={data.id}
            className="h-12 w-full rounded-2xl border-border/80 px-6 text-[15px] font-semibold sm:w-auto sm:min-w-[160px]"
          />
        ) : null}
      </div>
    </div>
  );
}
