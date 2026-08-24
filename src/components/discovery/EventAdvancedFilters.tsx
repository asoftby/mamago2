"use client";

import * as React from "react";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { useDiscoveryFilterOptions } from "@/features/filters/discovery/filters.api";
import { defaultFilters, serializeAppliedToSearchParams, useDiscoveryFilters, type DiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { normalizeDraftToAvailableTaxonomy, toggleEventCategory, useEventTaxonomy } from "@/features/filters/discovery/eventTaxonomy";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { ACTIVITY_FORMAT_OPTIONS } from "@/domain/activities/activity-format";
import { MobileOverlayResetAction } from "@/components/mobile/MobileOverlayResetAction";
import { formatPrice } from "@/lib/formatters/format-price";
import { renderPriceWithIcon } from "@/components/icons/BelarusianRubleIcon";

type PriceDistribution = { max: number | null; step: number | null; buckets: Array<{ from: number; to: number; count: number }> };

export function normalizePriceSliderValue(value: string, domainMax: number): number | null {
  const numericValue = Number(value);
  return numericValue >= domainMax ? null : numericValue;
}

export function EventAdvancedFilters({ citySlug, onApply }: { citySlug: string; onApply?: () => void }) {
  const { applied, actions } = useDiscoveryFilters();
  const { options, loading } = useDiscoveryFilterOptions(citySlug);
  const { categories, loading: taxonomyLoading } = useEventTaxonomy(citySlug);
  const [draft, setDraft] = React.useState<DiscoveryFilters>(() => ({ ...applied, age: [...applied.age] }));
  const [count, setCount] = React.useState<number | null>(null);
  const [distribution, setDistribution] = React.useState<PriceDistribution>({ max: null, step: null, buckets: [] });
  const patch = (next: Partial<DiscoveryFilters>) => setDraft((current) => ({ ...current, ...next }));
  const updatePriceMax = (value: string) => {
    patch({
      free: false,
      priceMax: normalizePriceSliderValue(value, distribution.max!),
    });
  };

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
      fetch(`/api/discovery/events/count?${params}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : null).then((data) => setCount(data?.count ?? null)).catch(() => {});
      params.delete("priceMax");
      fetch(`/api/discovery/events/price-distribution?${params}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : null).then((data) => data && setDistribution(data)).catch(() => {});
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [citySlug, draft]);

  const toggleAge = (value: string) => patch({ age: draft.age.includes(value) ? draft.age.filter((item) => item !== value) : [...draft.age, value] });
  const selectClass = "h-11 w-full appearance-none rounded-xl border border-neutral-200 bg-white pl-3 pr-9 text-sm";
  return (
    <div className="space-y-6 pb-1">
      <fieldset className="space-y-2"><legend className="text-sm font-semibold">Категория</legend><div className="flex flex-wrap gap-2">{categories.map((category) => <Chip key={category.id} active={draft.categories.includes(category.slug)} onClick={() => setDraft((current) => toggleEventCategory(current, category.slug, categories))}>{category.nameRu}</Chip>)}{taxonomyLoading && <span className="text-sm text-muted-foreground">Загрузка…</span>}</div></fieldset>
      {draft.categories.length > 0 && <fieldset className="space-y-4"><legend className="text-sm font-semibold">Жанр</legend>{categories.filter((category) => draft.categories.includes(category.slug)).map((category) => <div key={category.id} className="space-y-2"><div className="text-xs font-medium text-muted-foreground">{category.nameRu}</div><div className="flex flex-wrap gap-2">{category.genres.map((genre) => <Chip key={`${category.id}:${genre.id}`} active={draft.genres.includes(genre.slug)} onClick={() => patch({ genres: draft.genres.includes(genre.slug) ? draft.genres.filter((slug) => slug !== genre.slug) : [...draft.genres, genre.slug] })}>{genre.nameRu}</Chip>)}</div></div>)}</fieldset>}
      <fieldset className="space-y-2"><legend className="text-sm font-semibold">Возраст <span className="font-normal text-muted-foreground">· общий профиль</span></legend><div className="flex flex-wrap gap-2">{AGE_GROUPS.map((g) => <Chip key={g.value} active={draft.age.includes(g.value)} onClick={() => toggleAge(g.value)}>{g.label}</Chip>)}</div></fieldset>
      <fieldset><legend className="mb-2 text-sm font-semibold">Формат</legend><div className="flex flex-wrap gap-2">{ACTIVITY_FORMAT_OPTIONS.map(({ value, label }) => <Chip key={value} active={draft.format === value} onClick={() => patch({ format: draft.format === value ? null : value })}>{label}</Chip>)}</div></fieldset>
      <fieldset><legend className="mb-2 text-sm font-semibold">Где в городе</legend><div className="grid gap-3 sm:grid-cols-2">{([{ label: "Район", value: draft.district, options: options.districts, onChange: (value: string | null) => patch({ district: value }), placeholder: "Любой район" }, { label: "Метро", value: draft.metro, options: options.metros, onChange: (value: string | null) => patch({ metro: value }), placeholder: "Любое метро" }] as const).map((control) => <label key={control.label} className="relative block"><span className="sr-only">{control.label}</span><select className={selectClass} disabled={loading} value={control.value ?? ""} onChange={(e) => control.onChange(e.target.value || null)}><option value="">{control.placeholder}</option>{control.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-[10px] top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /></label>)}</div></fieldset>
      <fieldset className="space-y-4"><legend className="text-sm font-semibold">Цена</legend><Chip active={draft.free} onClick={() => patch({ free: !draft.free, priceMax: null })}>Бесплатно</Chip>{!draft.free && distribution.max != null && <div className="space-y-3"><div className="flex items-center justify-between gap-3 text-sm"><span>Цена начинается до</span><strong>{renderPriceWithIcon(formatPrice(draft.priceMax ?? distribution.max, { hideZero: true }))}</strong></div><div className="flex h-10 items-end gap-1" aria-hidden>{distribution.buckets.map((bucket, index) => { const peak = Math.max(1, ...distribution.buckets.map((item) => item.count)); return <span key={`${bucket.from}-${bucket.to}-${index}`} className="min-w-0 flex-1 rounded-t bg-primary/25" style={{ height: `${Math.max(3, (bucket.count / peak) * 100)}%` }} />; })}</div><input aria-label="Цена начинается до" className="h-10 w-full accent-primary" type="range" min={0} max={distribution.max} step={distribution.step ?? 1} value={draft.priceMax ?? distribution.max} onInput={(event) => updatePriceMax(event.currentTarget.value)} /></div>}</fieldset>
      <div className="sticky bottom-0 flex items-center justify-between border-t bg-white pt-4"><MobileOverlayResetAction className="lg:rounded-none lg:px-0 lg:py-0 lg:font-semibold lg:text-foreground lg:underline lg:hover:bg-transparent lg:hover:text-foreground lg:active:bg-transparent" onClick={() => setDraft({ ...defaultFilters, age: [], categories: [], genres: [] })}>Сбросить всё</MobileOverlayResetAction><Button className="rounded-full px-6" onClick={() => { actions.commitFilters(draft); onApply?.(); }}>Показать {count ?? "…"} событий</Button></div>
    </div>
  );
}
