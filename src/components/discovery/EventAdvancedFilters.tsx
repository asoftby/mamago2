"use client";

import * as React from "react";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { useDiscoveryFilterOptions } from "@/features/filters/discovery/filters.api";
import { defaultFilters, serializeAppliedToSearchParams, useDiscoveryFilters, type DiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { ACTIVITY_FORMAT_OPTIONS } from "@/domain/activities/activity-format";
import { MobileOverlayResetAction } from "@/components/mobile/MobileOverlayResetAction";

export function EventAdvancedFilters({ citySlug, onApply }: { citySlug: string; onApply?: () => void }) {
  const { applied, actions } = useDiscoveryFilters();
  const { options, loading } = useDiscoveryFilterOptions(citySlug);
  const [draft, setDraft] = React.useState<DiscoveryFilters>(() => ({ ...applied, age: [...applied.age] }));
  const [count, setCount] = React.useState<number | null>(null);
  const patch = (next: Partial<DiscoveryFilters>) => setDraft((current) => ({ ...current, ...next }));

  React.useEffect(() => {
    const controller = new AbortController();
    const params = serializeAppliedToSearchParams(new URLSearchParams(), draft);
    params.set("city", citySlug);
    const timer = setTimeout(() => fetch(`/api/discovery/events/count?${params}`, { signal: controller.signal }).then((r) => r.ok ? r.json() : null).then((data) => setCount(data?.count ?? null)).catch(() => {}), 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [draft, citySlug]);

  const toggleAge = (value: string) => patch({ age: draft.age.includes(value) ? draft.age.filter((item) => item !== value) : [...draft.age, value] });
  const selectClass = "h-11 w-full appearance-none rounded-xl border border-neutral-200 bg-white pl-3 pr-9 text-sm";
  return (
    <div className="space-y-6 pb-1">
      <fieldset className="space-y-2"><legend className="text-sm font-semibold">Возраст <span className="font-normal text-muted-foreground">· общий профиль</span></legend><div className="flex flex-wrap gap-2">{AGE_GROUPS.map((g) => <Chip key={g.value} active={draft.age.includes(g.value)} onClick={() => toggleAge(g.value)}>{g.label}</Chip>)}</div></fieldset>
      <fieldset><legend className="mb-2 text-sm font-semibold">Формат</legend><div className="flex flex-wrap gap-2">{ACTIVITY_FORMAT_OPTIONS.map(({ value, label }) => <Chip key={value} active={draft.format === value} onClick={() => patch({ format: draft.format === value ? null : value })}>{label}</Chip>)}</div></fieldset>
      <fieldset><legend className="mb-2 text-sm font-semibold">Где в городе</legend><div className="grid gap-3 sm:grid-cols-2">{([{ label: "Район", value: draft.district, options: options.districts, onChange: (value: string | null) => patch({ district: value }), placeholder: "Любой район" }, { label: "Метро", value: draft.metro, options: options.metros, onChange: (value: string | null) => patch({ metro: value }), placeholder: "Любое метро" }] as const).map((control) => <label key={control.label} className="relative block"><span className="sr-only">{control.label}</span><select className={selectClass} disabled={loading} value={control.value ?? ""} onChange={(e) => control.onChange(e.target.value || null)}><option value="">{control.placeholder}</option>{control.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-[10px] top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /></label>)}</div></fieldset>
      <fieldset><legend className="mb-2 text-sm font-semibold">Цена</legend><div className="flex gap-2"><Chip active={!draft.free} onClick={() => patch({ free: false })}>Любая</Chip><Chip active={draft.free} onClick={() => patch({ free: true })}>Бесплатно</Chip></div></fieldset>
      <div className="sticky bottom-0 flex items-center justify-between border-t bg-white pt-4"><MobileOverlayResetAction className="lg:rounded-none lg:px-0 lg:py-0 lg:font-semibold lg:text-foreground lg:underline lg:hover:bg-transparent lg:hover:text-foreground lg:active:bg-transparent" onClick={() => setDraft({ ...defaultFilters, age: [] })}>Сбросить всё</MobileOverlayResetAction><Button className="rounded-full px-6" onClick={() => { actions.commitFilters(draft); onApply?.(); }}>Показать {count ?? "…"} событий</Button></div>
    </div>
  );
}
