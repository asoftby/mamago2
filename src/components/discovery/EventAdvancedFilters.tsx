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
import { useEventListingExplore } from "@/lib/city/useEventListingCitySlug";

type PriceDistribution = {
  max: number | null;
  maxPrice: number | null;
  minPaid: number | null;
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

/** In a single-price range, keep the immovable thumbs at the track ends. */
export function priceThumbPercent(thumb: "min" | "max", value: number, lower: number, upper: number): number {
  if (upper <= lower) return thumb === "min" ? 0 : 100;
  return Math.min(100, Math.max(0, ((value - lower) / (upper - lower)) * 100));
}

function PriceRangeControl({
  distribution,
  value,
  onChange,
  showHistogram = true,
  inactive = false,
}: {
  distribution: PriceDistribution;
  value: PriceRangeValue;
  onChange: (next: PriceRangeValue) => void;
  showHistogram?: boolean;
  inactive?: boolean;
}) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  // Integer thumb positions enclose fractional prices without excluding events.
  const lower = Math.floor(distribution.minPaid ?? 0);
  const upper = Math.ceil(distribution.maxPrice ?? distribution.max ?? lower);
  const locked = lower >= upper;
  const disabled = inactive || locked;
  const minValue = Math.min(upper, Math.max(lower, value.min ?? lower));
  const maxValue = Math.max(minValue, Math.min(upper, value.max ?? upper));
  const peak = Math.max(1, ...distribution.buckets.map((item) => item.count));
  const minPercent = priceThumbPercent("min", minValue, lower, upper);
  const maxPercent = priceThumbPercent("max", maxValue, lower, upper);
  const emit = (thumb: "min" | "max", raw: number) => {
    if (disabled) return;
    if (thumb === "min") {
      const nextMin = Math.min(maxValue, Math.max(lower, raw));
      onChange({ min: nextMin <= lower ? null : nextMin, max: maxValue >= upper ? null : maxValue });
    } else {
      const nextMax = Math.max(minValue, Math.min(upper, raw));
      onChange({ min: minValue <= lower ? null : minValue, max: nextMax >= upper ? null : nextMax });
    }
  };
  const valueFromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (disabled || !rect || rect.width <= 0) return null;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.min(upper, Math.max(lower, lower + Math.round(ratio * (upper - lower))));
  };
  const moveNearestThumb = (clientX: number) => {
    const next = valueFromPointer(clientX);
    if (next == null) return;
    emit(Math.abs(next - minValue) <= Math.abs(next - maxValue) ? "min" : "max", next);
  };
  const handleThumbPointer = (thumb: "min" | "max", event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = valueFromPointer(event.clientX);
    if (next != null) emit(thumb, next);
  };
  const handleThumbMove = (thumb: "min" | "max", event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const next = valueFromPointer(event.clientX);
    if (next != null) emit(thumb, next);
  };
  const handleThumbKey = (thumb: "min" | "max", event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const current = thumb === "min" ? minValue : maxValue;
    const next = event.key === "Home" ? lower : event.key === "End" ? upper
      : event.key === "ArrowLeft" || event.key === "ArrowDown" ? Math.max(lower, current - 1)
      : event.key === "ArrowRight" || event.key === "ArrowUp" ? Math.min(upper, current + 1) : null;
    if (next == null) return;
    event.preventDefault();
    emit(thumb, next);
  };

  return (
    <div className={cn("space-y-4", inactive && "opacity-40")} aria-disabled={disabled}>
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
          className={cn("relative mx-5 h-12 touch-none select-none", disabled && "pointer-events-none")}
          onPointerDown={(event) => moveNearestThumb(event.clientX)}
        >
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-primary/25" />
          <div
            className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-primary"
            style={{
              left: `${minPercent}%`,
              right: `${100 - maxPercent}%`,
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
                aria-valuemin={thumb === "min" ? lower : minValue}
                aria-valuemax={thumb === "min" ? maxValue : upper}
                aria-valuenow={current}
                aria-valuetext={formatPrice(current)}
                aria-disabled={disabled}
                disabled={disabled}
                className={cn(
                  "absolute top-1/2 z-10 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full sm:h-9 sm:w-9",
                  "border-2 border-primary bg-background shadow-[0_6px_20px_rgba(0,0,0,0.14)]",
                  "outline-none transition-transform hover:scale-105",
                  "focus-visible:ring-4 focus-visible:ring-primary/20",
                  "active:scale-95",
                )}
                style={{ left: `${thumb === "min" ? minPercent : maxPercent}%` }}
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
        <div className="flex max-w-[calc(50%-0.375rem)] flex-col items-center gap-2">
          <span className="text-center text-xs font-normal text-muted-foreground">Минимум</span>
          <div className="inline-flex h-9 max-w-full items-center justify-center rounded-full border border-border bg-white px-4 text-sm font-normal text-foreground">
            {renderPriceWithIcon(formatPrice(value.min == null ? (distribution.minPaid ?? minValue) : minValue), { iconSize: "text" })}
          </div>
        </div>
        <div className="flex max-w-[calc(50%-0.375rem)] flex-col items-center gap-2">
          <span className="text-center text-xs font-normal text-muted-foreground">Максимум</span>
          <div className="inline-flex h-9 max-w-full items-center justify-center rounded-full border border-border bg-white px-4 text-sm font-normal text-foreground">
            {renderPriceWithIcon(formatPrice(value.max == null ? (distribution.maxPrice ?? maxValue) : maxValue), { iconSize: "text" })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EventAdvancedFilters({ citySlug, onApply }: { citySlug: string; onApply?: () => void }) {
  const { applied, actions } = useDiscoveryFilters();
  const [draft, setDraft] = React.useState<DiscoveryFilters>(() => applied);
  const family = useFamilyPersona();
  const facets = useEventAvailableFacets(applied);
  const explore = useEventListingExplore();
  const { categories, loading: taxonomyLoading } = useEventTaxonomy(citySlug);
  const [count, setCount] = React.useState<number | null>(null);
  const [distribution, setDistribution] = React.useState<PriceDistribution>({ max: null, maxPrice: null, minPaid: null, step: null, buckets: [] });
  const patch = (next: Partial<DiscoveryFilters>) => setDraft(prev => mergeDiscoveryPatch(prev, next));

  React.useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = serializeAppliedToSearchParams(new URLSearchParams(), applied);
      params.set("city", citySlug);
      if (explore) params.set("explore", "1");
      fetch(`/api/discovery/events/count?${params}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : null)
        .then((data) => setCount(data?.count ?? null))
        .catch(() => {});

      params.delete("priceMin");
      params.delete("priceMax");
      params.delete("free");
      fetch(`/api/discovery/events/price-distribution?${params}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : null)
        .then((data: PriceDistribution | null) => {
          if (!data) return;
          setDistribution(data);
        })
        .catch(() => {});
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [citySlug, applied, explore]);

  return (
    <div className="space-y-6 pb-1">
      <DiscoveryWhoFilter inline draftFilters={draft} onDraftPatch={patch} />

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
              onClick={() => setDraft(toggleEventCategory(draft, category.slug, categories))}
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

        {distribution.minPaid != null && distribution.maxPrice != null && (
          <PriceRangeControl
            distribution={distribution}
            value={{ min: draft.priceMin, max: draft.priceMax }}
            inactive={draft.free}
            showHistogram={distribution.buckets.some(bucket => bucket.count > 0)}
            onChange={(next) => patch({
              free: false,
              priceMin: next.min,
              priceMax: next.max,
            })}
          />
        )}
      </fieldset>}

      <div className="fixed bottom-0 left-0 right-0 z-10 flex items-center gap-2 border-t bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:sticky lg:mx-0 lg:justify-between lg:bg-white/95 lg:px-0 lg:pb-0 lg:pt-4 lg:backdrop-blur-none">
        <MobileOverlayResetAction
          className="min-h-11 px-2 lg:min-h-0 lg:rounded-none lg:px-0 lg:py-0 lg:font-semibold lg:text-foreground lg:underline lg:hover:bg-transparent lg:hover:text-foreground lg:active:bg-transparent"
          onClick={() => {
            family?.setSelectedPersonaIds([]);
            const reset = resetEventRefinements(draft);
            setDraft(reset);
            actions.commitFilters(reset);
            onApply?.();
          }}
        >
          <span className="sm:hidden">Сбросить</span>
          <span className="hidden sm:inline">Сбросить уточнения</span>
        </MobileOverlayResetAction>
        <MobileOverlayPrimaryAction className="min-w-0 flex-1 lg:hidden" onClick={() => { actions.commitFilters(draft); onApply?.(); }}>
          Показать события
        </MobileOverlayPrimaryAction>
        <Button className="hidden min-h-11 rounded-full px-6 text-sm lg:inline-flex" onClick={() => onApply?.()}>
          Показать {count == null ? "…" : pluralize(count, ["событие", "события", "событий"])}
        </Button>
      </div>
    </div>
  );
}
