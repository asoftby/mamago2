"use client";

import * as React from "react";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { useDiscoveryFilterOptions } from "@/features/filters/discovery/filters.api";
import { defaultFilters, serializeAppliedToSearchParams, useDiscoveryFilters, type DiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/button";

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
  const selectClass = "h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm";
  return (
    <div className="space-y-6 pb-1">
      <fieldset><legend className="mb-1 text-sm font-semibold">Возраст <span className="font-normal text-muted-foreground">· общий профиль</span></legend><p className="mb-3 text-xs text-muted-foreground">Настройка синхронизирована с возрастом в шапке.</p><div className="flex flex-wrap gap-2">{AGE_GROUPS.map((g) => <Chip key={g.value} active={draft.age.includes(g.value)} onClick={() => toggleAge(g.value)}>{g.label}</Chip>)}</div></fieldset>
      <fieldset><legend className="mb-2 text-sm font-semibold">Формат</legend><div className="flex flex-wrap gap-2">{([['OFFLINE','Офлайн'],['ONLINE','Онлайн'],['HYBRID','Гибрид']] as const).map(([value,label]) => <Chip key={value} active={draft.format === value} onClick={() => patch({ format: draft.format === value ? null : value })}>{label}</Chip>)}</div></fieldset>
      <fieldset><legend className="mb-2 text-sm font-semibold">Где в городе</legend><div className="grid gap-3 sm:grid-cols-2"><label><span className="sr-only">Район</span><select className={selectClass} disabled={loading} value={draft.district ?? ""} onChange={(e) => patch({ district: e.target.value || null })}><option value="">Любой район</option>{options.districts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label><label><span className="sr-only">Метро</span><select className={selectClass} disabled={loading} value={draft.metro ?? ""} onChange={(e) => patch({ metro: e.target.value || null })}><option value="">Любое метро</option>{options.metros.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label></div></fieldset>
      <fieldset><legend className="mb-2 text-sm font-semibold">Цена</legend><div className="flex gap-2"><Chip active={!draft.free} onClick={() => patch({ free: false })}>Любая</Chip><Chip active={draft.free} onClick={() => patch({ free: true })}>Бесплатно</Chip></div></fieldset>
      <div className="sticky bottom-0 flex items-center justify-between border-t bg-white pt-4"><button type="button" className="text-sm font-semibold underline" onClick={() => setDraft({ ...defaultFilters, age: [] })}>Сбросить всё</button><Button className="rounded-full px-6" onClick={() => { actions.commitFilters(draft); onApply?.(); }}>Показать {count ?? "…"} событий</Button></div>
    </div>
  );
}
