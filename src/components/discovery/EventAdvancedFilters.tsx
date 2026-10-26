"use client";

import * as React from "react";
import { serializeAppliedToSearchParams, useDiscoveryFilters, getDiscoveryFilterActiveCount, defaultFilters, type DiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { toggleEventCategory, useEventTaxonomy } from "@/features/filters/discovery/eventTaxonomy";
import { Chip } from "@/components/ui/Chip";
import { DiscoveryWhoFilter } from "./DiscoveryWhoFilter";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { pluralize } from "@/lib/formatters/pluralize";
import { useEventAvailableFacets } from "@/features/filters/discovery/useEventAvailableFacets";
import { Button } from "@/components/ui/button";
import { ACTIVITY_FORMAT_OPTIONS } from "@/domain/activities/activity-format";
import { MobileOverlayResetAction } from "@/components/mobile/MobileOverlayResetAction";
import { MobileOverlayPrimaryAction } from "@/components/mobile/MobileOverlayPrimaryAction";
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

/** Full reset: the selected city lives in the route, not in these filters. */
export function resetEventRefinements(_filters: DiscoveryFilters): DiscoveryFilters {
  return { ...defaultFilters };
}

/** The modal now owns the same facets as the quick row and header. */
export function getEventRefinementCount(filters: DiscoveryFilters): number {
  return getDiscoveryFilterActiveCount(filters);
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
  showHistogram = true,
}: {
  distribution: PriceDistribution;
  value: PriceRangeValue;
  onChange: (next: PriceRangeValue) => void;
  showHistogram?: boolean;
}) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const domainMax = distribution.max ?? 0;
  const step = Math.max(1, distribution.step ?? 1);
  const minValue = Math.min(Math.max(0, value.min ?? 0), domainMax);
  const maxValue = Math.max(minValue, Math.min(value.max ?? domainMax, domainMax));
  const peak = Math.max(1, ...distribution.buckets.map((item) => item.count));
  const lowestPaidPrice = Math.min(...distribution.buckets.filter((bucket) => bucket.to > 0 && bucket.count > 0).map((bucket) => Math.max(0, bucket.from)), Number.POSITIVE_INFINITY);
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
        {showHistogram && distribution.buckets.length > 0 && <div className="flex h-24 items-end gap-1 px-5" aria-hidden>
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
        </div>}

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
                  "absolute top-1/2 z-10 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full sm:h-9 sm:w-9",
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

      <div className="flex items-start justify-between gap-3">
        <div className="flex max-w-[calc(50%-0.375rem)] flex-col items-start gap-2">
          <span className="text-sm font-medium text-muted-foreground">Минимум</span>
          <div className="rounded-full border border-border bg-background px-4 py-3 text-base font-semibold text-foreground">
            {minValue > 0
              ? renderPriceWithIcon(formatPrice(minValue))
              : Number.isFinite(lowestPaidPrice) && lowestPaidPrice > 0
                ? renderPriceWithIcon(formatPrice(lowestPaidPrice))
                : "Без ограничения"}
          </div>
        </div>
        <div className="flex max-w-[calc(50%-0.375rem)] flex-col items-end gap-2">
          <span className="text-sm font-medium text-muted-foreground">Максимум</span>
          <div className="rounded-full border border-border bg-background px-4 py-3 text-base font-semibold text-foreground">
            {renderPriceWithIcon(formatPrice(maxValue))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EventAdvancedFilters({ citySlug, onApply }: { citySlug: string; onApply?: () => void }) {
  const { applied: draft, actions } = useDiscoveryFilters();
  const family = useFamilyPersona();
  const facets = useEventAvailableFacets(draft);
  const { categories, loading: taxonomyLoading } = useEventTaxonomy(citySlug);
  const [count, setCount] = React.useState<number | null>(null);
  const [distribution, setDistribution] = React.useState<PriceDistribution>({ max: null, step: null, buckets: [] });
  const patch = (next: Partial<DiscoveryFilters>) => actions.setDraft(next);

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
        })
        .catch(() => {});
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [citySlug, draft]);

  return (
    <div className="space-y-6 pb-1">
      <DiscoveryWhoFilter inline />

      {(draft.occasionSlug === "halloween" || facets?.occasions.includes("halloween")) && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Повод</legend>
          <Chip active={draft.occasionSlug === "halloween"} onClick={() => patch({ occasionSlug: draft.occasionSlug === "halloween" ? null : "halloween" })}>Хэллоуин</Chip>
        </fieldset>
      )}

      {categories.some(category => !facets || facets.categories.includes(category.slug) || draft.categories.includes(category.slug)) && <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Категория</legend>
        <div className="flex flex-wrap gap-2">
          {categories.filter(category => !facets || facets.categories.includes(category.slug) || draft.categories.includes(category.slug)).map((category) => (
            <Chip
              key={category.id}
              active={draft.categories.includes(category.slug)}
              onClick={() => actions.commitFilters(toggleEventCategory(draft, category.slug, categories))}
            >
              {category.nameRu}
            </Chip>
          ))}
          {taxonomyLoading && <span className="text-sm text-muted-foreground">Загрузка…</span>}
        </div>
      </fieldset>}

      {draft.categories.length > 0 && categories.some(category => draft.categories.includes(category.slug) && category.genres.some(genre => !facets || facets.genres.includes(genre.slug) || draft.genres.includes(genre.slug))) && (
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold">Жанр</legend>
          {categories
            .filter((category) => draft.categories.includes(category.slug))
            .map((category) => (
              <div key={category.id} className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">{category.nameRu}</div>
                <div className="flex flex-wrap gap-2">
                  {category.genres.filter(genre => !facets || facets.genres.includes(genre.slug) || draft.genres.includes(genre.slug)).map((genre) => (
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

      {(!facets || facets.formats.length > 0 || draft.format != null) && <fieldset>
        <legend className="mb-2 text-sm font-semibold">Формат</legend>
        <div className="flex flex-wrap gap-2">
          {ACTIVITY_FORMAT_OPTIONS.filter(option => !facets || facets.formats.includes(option.value) || draft.format === option.value).map(({ value, label }) => (
            <Chip
              key={value}
              active={draft.format === value}
              onClick={() => patch({ format: draft.format === value ? null : value })}
            >
              {label}
            </Chip>
          ))}
        </div>
      </fieldset>}

      {(!facets || facets.freeAvailable || distribution.max != null || draft.free || draft.priceMin != null || draft.priceMax != null) && <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Цена</legend>
        {(!facets || facets.freeAvailable || draft.free) && <Chip
          active={draft.free}
          onClick={() => patch({
            free: !draft.free,
            priceMin: null,
            priceMax: null,
          })}
        >
          Бесплатно
        </Chip>}

        {!draft.free && distribution.max != null && distribution.max > 0 && (
          <PriceRangeControl
            distribution={distribution}
            value={{ min: draft.priceMin, max: draft.priceMax }}
            showHistogram={distribution.buckets.some(bucket => bucket.count > 0)}
            onChange={(next) => patch({
              free: false,
              priceMin: next.min,
              priceMax: next.max,
            })}
          />
        )}
      </fieldset>}

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-2 border-t bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:mx-0 lg:justify-between lg:px-0 lg:pb-0 lg:pt-4 lg:backdrop-blur-none">
        <MobileOverlayResetAction
          className="min-h-11 px-2 lg:min-h-0 lg:rounded-none lg:px-0 lg:py-0 lg:font-semibold lg:text-foreground lg:underline lg:hover:bg-transparent lg:hover:text-foreground lg:active:bg-transparent"
          onClick={() => {
            family?.setSelectedPersonaIds([]);
            actions.commitFilters(resetEventRefinements(draft));
            onApply?.();
          }}
        >
          <span className="sm:hidden">Сбросить</span>
          <span className="hidden sm:inline">Сбросить уточнения</span>
        </MobileOverlayResetAction>
        <MobileOverlayPrimaryAction className="min-w-0 flex-1 lg:hidden" onClick={() => onApply?.()}>
          Показать {count == null ? "…" : pluralize(count, ["событие", "события", "событий"])}
        </MobileOverlayPrimaryAction>
        <Button className="hidden min-h-11 rounded-full px-6 text-sm lg:inline-flex" onClick={() => onApply?.()}>
          Показать {count == null ? "…" : pluralize(count, ["событие", "события", "событий"])}
        </Button>
      </div>
    </div>
  );
}
