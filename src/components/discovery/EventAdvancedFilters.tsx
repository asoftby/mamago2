"use client";

import * as React from "react";
import { serializeAppliedToSearchParams, useDiscoveryFilters, type DiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { normalizeDraftToAvailableTaxonomy, toggleEventCategory, useEventTaxonomy } from "@/features/filters/discovery/eventTaxonomy";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/button";
import { ACTIVITY_FORMAT_OPTIONS } from "@/domain/activities/activity-format";
import { MobileOverlayResetAction } from "@/components/mobile/MobileOverlayResetAction";
import { formatPrice } from "@/lib/formatters/format-price";
import { renderPriceWithIcon } from "@/components/icons/BelarusianRubleIcon";
import { cn } from "@/lib/utils";

type PriceDistribution = {
  max: number | null;
  step: number | null;
  buckets: Array<{ from: number; to: number; count: number }>;
};

type PriceRangeValue = {
  min: number | null;
  max: number | null;
};

/**
 * Kuda header owns the global discovery context: where, when and who.
 * The advanced dialog only refines that context and must never reset it.
 */
export function resetEventRefinements(filters: DiscoveryFilters): DiscoveryFilters {
  return {
    ...filters,
    categories: [],
    genres: [],
    format: null,
    free: false,
    priceMin: null,
    priceMax: null,
    // Legacy strict #nokids lived in secondary filters. Header audience is now authoritative.
    adultOnly: false,
  };
}

/** Badge next to “Фильтры” counts only refinements, never global header context. */
export function getEventRefinementCount(filters: DiscoveryFilters): number {
  return (
    (filters.categories.length > 0 ? 1 : 0) +
    (filters.genres.length > 0 ? 1 : 0) +
    (filters.format ? 1 : 0) +
    (filters.free || filters.priceMin != null || filters.priceMax != null ? 1 : 0)
  );
}

export function normalizePriceSliderValue(value: string, domainMax: number): number | null {
  const numericValue = Number(value);
  return numericValue >= domainMax ? null : numericValue;
}

export function normalizePriceMinSliderValue(value: string): number | null {
  const numericValue = Number(value);
  return numericValue <= 0 ? null : numericValue;
}

export function priceSliderValueFromPosition(clientX: number, left: number, width: number, domainMax: number, step: number): number {
  const ratio = Math.min(1, Math.max(0, (clientX - left) / width));
  return Math.min(domainMax, Math.max(0, Math.round((ratio * domainMax) / step) * step));
}

export function priceSliderValueFromKey(key: string, current: number, domainMax: number, step: number): number | undefined {
  if (key === "Home") return 0;
  if (key === "End") return domainMax;
  if (key === "ArrowLeft" || key === "ArrowDown") return Math.max(0, current - step);
  if (key === "ArrowRight" || key === "ArrowUp") return Math.min(domainMax, current + step);
  return undefined;
}

function PriceRangeControl({
  distribution,
  value,
  onChange,
}: {
  distribution: PriceDistribution;
  value: PriceRangeValue;
  onChange: (next: PriceRangeValue) => void;
}) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const domainMax = distribution.max ?? 0;
  const step = Math.max(1, distribution.step ?? 1);
  const minValue = Math.min(Math.max(0, value.min ?? 0), domainMax);
  const maxValue = Math.max(minValue, Math.min(value.max ?? domainMax, domainMax));
  const peak = Math.max(1, ...distribution.buckets.map((item) => item.count));
  const pct = (n: number) => domainMax > 0 ? (n / domainMax) * 100 : 0;

  const emit = (thumb: "min" | "max", raw: number) => {
    if (thumb === "min") {
      const nextMin = Math.min(maxValue, Math.max(0, raw));
      onChange({
        min: normalizePriceMinSliderValue(String(nextMin)),
        max: maxValue >= domainMax ? null : maxValue,
      });
      return;
    }
    const nextMax = Math.max(minValue, Math.min(domainMax, raw));
    onChange({
      min: minValue <= 0 ? null : minValue,
      max: normalizePriceSliderValue(String(nextMax), domainMax),
    });
  };

  const valueFromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    return priceSliderValueFromPosition(clientX, rect.left, rect.width, domainMax, step);
  };

  const moveNearestThumb = (clientX: number) => {
    const next = valueFromPointer(clientX);
    if (next == null) return;
    emit(Math.abs(next - minValue) <= Math.abs(next - maxValue) ? "min" : "max", next);
  };

  const handleThumbPointer = (
    thumb: "min" | "max",
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = valueFromPointer(event.clientX);
    if (next != null) emit(thumb, next);
  };

  const handleThumbMove = (
    thumb: "min" | "max",
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const next = valueFromPointer(event.clientX);
    if (next != null) emit(thumb, next);
  };

  const handleThumbKey = (
    thumb: "min" | "max",
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    const current = thumb === "min" ? minValue : maxValue;
    const next = priceSliderValueFromKey(event.key, current, domainMax, step);
    if (next == null) return;
    event.preventDefault();
    emit(thumb, next);
  };

  return (
    <div className="space-y-4">
      <div className="relative pt-2">
        <div className="flex h-24 items-end gap-1 px-5" aria-hidden>
          {distribution.buckets.map((bucket, index) => {
            const midpoint = (bucket.from + bucket.to) / 2;
            const selected = midpoint >= minValue && midpoint <= maxValue;
            return (
              <span
                key={`${bucket.from}-${bucket.to}-${index}`}
                className={cn(
                  "min-w-0 flex-1 rounded-t-[3px] transition-colors",
                  selected ? "bg-primary" : "bg-primary/20",
                )}
                style={{ height: `${Math.max(4, (bucket.count / peak) * 100)}%` }}
              />
            );
          })}
        </div>

        <div
          ref={trackRef}
          className="relative mx-5 h-12 touch-none select-none"
          onPointerDown={(event) => moveNearestThumb(event.clientX)}
        >
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-primary/25" />
          <div
            className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-primary"
            style={{
              left: `${pct(minValue)}%`,
              right: `${100 - pct(maxValue)}%`,
            }}
          />

          {(["min", "max"] as const).map((thumb) => {
            const current = thumb === "min" ? minValue : maxValue;
            return (
              <button
                key={thumb}
                type="button"
                role="slider"
                aria-label={thumb === "min" ? "Минимальная цена" : "Максимальная цена"}
                aria-valuemin={thumb === "min" ? 0 : minValue}
                aria-valuemax={thumb === "min" ? maxValue : domainMax}
                aria-valuenow={current}
                aria-valuetext={formatPrice(current)}
                className={cn(
                  "absolute top-1/2 z-10 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full",
                  "border-2 border-primary bg-background shadow-[0_6px_20px_rgba(0,0,0,0.14)]",
                  "outline-none transition-transform hover:scale-105",
                  "focus-visible:ring-4 focus-visible:ring-primary/20",
                  "active:scale-95",
                )}
                style={{ left: `${pct(current)}%` }}
                onPointerDown={(event) => handleThumbPointer(thumb, event)}
                onPointerMove={(event) => handleThumbMove(thumb, event)}
                onKeyDown={(event) => handleThumbKey(thumb, event)}
              >
                <span className="sr-only">
                  {thumb === "min" ? "Минимальная цена" : "Максимальная цена"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-background px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">От</div>
          <div className="mt-1 text-base font-semibold text-foreground">
            {renderPriceWithIcon(formatPrice(minValue))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-background px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">До</div>
          <div className="mt-1 text-base font-semibold text-foreground">
            {renderPriceWithIcon(formatPrice(maxValue))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EventAdvancedFilters({ citySlug, onApply }: { citySlug: string; onApply?: () => void }) {
  const { applied, actions } = useDiscoveryFilters();
  const { categories, loading: taxonomyLoading } = useEventTaxonomy(citySlug);
  const [draft, setDraft] = React.useState<DiscoveryFilters>(() => ({ ...applied, age: [...applied.age] }));
  const [count, setCount] = React.useState<number | null>(null);
  const [distribution, setDistribution] = React.useState<PriceDistribution>({ max: null, step: null, buckets: [] });
  const patch = (next: Partial<DiscoveryFilters>) => setDraft((current) => ({ ...current, ...next }));

  React.useEffect(() => {
    if (!taxonomyLoading) {
      setDraft((current) => normalizeDraftToAvailableTaxonomy(current, categories));
    }
  }, [categories, taxonomyLoading]);

  React.useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = serializeAppliedToSearchParams(new URLSearchParams(), draft);
      params.set("city", citySlug);
      fetch(`/api/discovery/events/count?${params}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : null)
        .then((data) => setCount(data?.count ?? null))
        .catch(() => {});

      params.delete("priceMin");
      params.delete("priceMax");
      fetch(`/api/discovery/events/price-distribution?${params}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : null)
        .then((data: PriceDistribution | null) => {
          if (!data) return;
          setDistribution(data);
          if (data.max == null) return;
          setDraft((current) => {
            const nextMin = current.priceMin == null ? null : Math.min(current.priceMin, data.max!);
            const nextMax = current.priceMax == null || current.priceMax >= data.max!
              ? null
              : Math.max(current.priceMax, nextMin ?? 0);
            if (nextMin === current.priceMin && nextMax === current.priceMax) return current;
            return { ...current, priceMin: nextMin, priceMax: nextMax };
          });
        })
        .catch(() => {});
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [citySlug, draft]);

  return (
    <div className="space-y-6 pb-1">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Категория</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Chip
              key={category.id}
              active={draft.categories.includes(category.slug)}
              onClick={() => setDraft((current) => toggleEventCategory(current, category.slug, categories))}
            >
              {category.nameRu}
            </Chip>
          ))}
          {taxonomyLoading && <span className="text-sm text-muted-foreground">Загрузка…</span>}
        </div>
      </fieldset>

      {draft.categories.length > 0 && (
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold">Жанр</legend>
          {categories
            .filter((category) => draft.categories.includes(category.slug))
            .map((category) => (
              <div key={category.id} className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">{category.nameRu}</div>
                <div className="flex flex-wrap gap-2">
                  {category.genres.map((genre) => (
                    <Chip
                      key={`${category.id}:${genre.id}`}
                      active={draft.genres.includes(genre.slug)}
                      onClick={() => patch({
                        genres: draft.genres.includes(genre.slug)
                          ? draft.genres.filter((slug) => slug !== genre.slug)
                          : [...draft.genres, genre.slug],
                      })}
                    >
                      {genre.nameRu}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Формат</legend>
        <div className="flex flex-wrap gap-2">
          {ACTIVITY_FORMAT_OPTIONS.map(({ value, label }) => (
            <Chip
              key={value}
              active={draft.format === value}
              onClick={() => patch({ format: draft.format === value ? null : value })}
            >
              {label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Цена</legend>
        <Chip
          active={draft.free}
          onClick={() => patch({
            free: !draft.free,
            priceMin: null,
            priceMax: null,
          })}
        >
          Бесплатно
        </Chip>

        {!draft.free && distribution.max != null && distribution.max > 0 && (
          <PriceRangeControl
            distribution={distribution}
            value={{ min: draft.priceMin, max: draft.priceMax }}
            onChange={(next) => patch({
              free: false,
              priceMin: next.min,
              priceMax: next.max,
            })}
          />
        )}
      </fieldset>

      <div className="sticky bottom-0 flex items-center justify-between border-t bg-white pt-4">
        <MobileOverlayResetAction
          className="lg:rounded-none lg:px-0 lg:py-0 lg:font-semibold lg:text-foreground lg:underline lg:hover:bg-transparent lg:hover:text-foreground lg:active:bg-transparent"
          onClick={() => setDraft((current) => resetEventRefinements(current))}
        >
          Сбросить уточнения
        </MobileOverlayResetAction>
        <Button
          className="rounded-full px-6"
          onClick={() => {
            actions.commitFilters(draft);
            onApply?.();
          }}
        >
          Показать {count ?? "…"} событий
        </Button>
      </div>
    </div>
  );
}
