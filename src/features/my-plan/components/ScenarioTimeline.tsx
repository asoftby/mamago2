"use client";

import { MediaCover } from "@/components/ui/media-cover";
import { formatPriceFrom, normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import type { PlanItemWithActivity } from "../types/event";
import { formatActivityAddressLine } from "../lib/formatActivityAddress";

type ScenarioTimelineProps = {
  items: PlanItemWithActivity[];
  conflictIds?: Set<string>;
};

function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatPrice(activity: NonNullable<PlanItemWithActivity["activity"]>): string | null {
  const text = activity.priceText?.trim();
  if (text) return normalizeUiCurrencyText(text);
  if (activity.priceFrom === 0) return "Бесплатно";
  if (activity.priceFrom != null && !Number.isNaN(activity.priceFrom)) {
    return formatPriceFrom(activity.priceFrom, { hideZero: true });
  }
  return null;
}

export function ScenarioTimeline({ items, conflictIds }: ScenarioTimelineProps) {
  return (
    <div className="relative">
      <div className="absolute left-[19px] top-2 bottom-2 w-px bg-neutral-200" />
      <div className="space-y-5">
        {items.map((item) => {
          const title = item.title || item.activity?.title || "Активность";
          const age = item.activity?.ageLabel?.trim();
          const place = item.activity ? formatActivityAddressLine(item.activity) : null;
          const price = item.activity ? formatPrice(item.activity) : null;
          const meta = [age, place, price].filter(Boolean).join(" · ");
          const imageUrl = item.coverImageUrl || item.activity?.coverImageUrl;
          const hasConflict = conflictIds?.has(item.id) ?? false;

          return (
            <div key={item.id} className="relative flex gap-4">
              <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center">
                <div className="h-3 w-3 rounded-full border-2 border-primary bg-white" />
              </div>
              <div className="min-w-0 flex-1 rounded-[22px] border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-primary">
                      {formatTime(item.startsAt) || "Без времени"}
                    </p>
                    <h3 className="mt-1 text-base font-semibold leading-snug text-neutral-900">
                      {title}
                    </h3>
                    {meta ? (
                      <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{meta}</p>
                    ) : null}
                    {hasConflict ? (
                      <p className="mt-1.5 text-sm font-medium text-amber-600">
                        ⚠ Время пересекается
                      </p>
                    ) : null}
                  </div>
                  {imageUrl ? (
                    <div className="w-16 shrink-0">
                      <MediaCover imageUrl={imageUrl} alt={title} ratio="1/1" className="rounded-2xl" />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
