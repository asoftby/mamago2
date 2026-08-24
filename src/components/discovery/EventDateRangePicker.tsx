"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Chip } from "@/components/ui/Chip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { dateRangeReducer, emptyDateRangeDraft } from "@/features/filters/discovery/dateRangeReducer";
import { computePresetRange, todayKeyIn } from "@/features/filters/discovery/quickFilterPresets";
import { serializeAppliedToSearchParams, type DiscoveryFilters, type WhenPreset } from "@/features/filters/discovery/filters.store";
import { addDateKeyDays } from "@/lib/stories/ranges";
import { useOptionalCity } from "@/contexts/CityContext";
import { MobileOverlayResetAction } from "@/components/mobile/MobileOverlayResetAction";

const toKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fromKey = (key: string | null) => key ? new Date(`${key}T12:00:00`) : null;

export function EventDateRangePicker({ applied, onApply }: { applied: DiscoveryFilters; onApply: (patch: Partial<DiscoveryFilters>) => void }) {
  const mobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const [draft, dispatch] = React.useReducer(dateRangeReducer, emptyDateRangeDraft);
  const [density, setDensity] = React.useState<Record<string, number>>({});
  const [resultCount, setResultCount] = React.useState<number | null>(null);
  const today = todayKeyIn(new Date());
  const city = useOptionalCity()?.citySlug ?? "minsk";

  React.useEffect(() => {
    if (open) dispatch({ type: "hydrate", from: applied.dateFrom, to: applied.dateTo });
  }, [open, applied.dateFrom, applied.dateTo]);
  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const nonDate = { ...applied, dateFrom: null, dateTo: null, whenPreset: null };
    const params = serializeAppliedToSearchParams(new URLSearchParams(), nonDate);
    params.set("city", city); params.set("windowFrom", today); params.set("windowTo", addDateKeyDays(today, 123));
    fetch(`/api/calendar/density?${params}`, { signal: controller.signal }).then((r) => r.ok ? r.json() : {}).then(setDensity).catch(() => {});
    return () => controller.abort();
  }, [open, applied, city, today]);
  React.useEffect(() => {
    if (!open || !draft.from) { setResultCount(null); return; }
    const controller = new AbortController();
    const candidate = { ...applied, whenPreset: null, dateFrom: draft.from, dateTo: draft.to };
    const params = serializeAppliedToSearchParams(new URLSearchParams(), candidate);
    params.set("city", city);
    const timer = setTimeout(() => fetch(`/api/discovery/events/count?${params}`, { signal: controller.signal }).then((r) => r.ok ? r.json() : null).then((data) => setResultCount(data?.count ?? null)).catch(() => {}), 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, draft.from, draft.to, applied, city]);

  const select = (date: Date | null) => {
    if (!date) return;
    const previousSelecting = draft.selectingEnd;
    const key = toKey(date);
    dispatch({ type: "select", date: key, today });
    if (!mobile && previousSelecting && draft.from && key >= draft.from) {
      onApply({ whenPreset: null, dateFrom: draft.from, dateTo: key });
      setOpen(false);
    }
  };
  const applyPreset = (preset: Exclude<WhenPreset, null>) => {
    const range = computePresetRange(preset, today);
    dispatch({ type: "hydrate", from: range.from, to: range.to });
  };
  const label = applied.dateFrom
    ? applied.dateFrom === applied.dateTo || !applied.dateTo ? applied.dateFrom : `${applied.dateFrom} — ${applied.dateTo}`
    : "Выбрать даты";
  const calendar = (months: 1 | 2, defaultMonth?: Date) => (
    <Calendar value={fromKey(draft.from)} rangeStart={fromKey(draft.from)} rangeEnd={fromKey(draft.to)} onChange={select} disablePast numberOfMonths={months} defaultMonth={defaultMonth} size="compact" density={density} />
  );
  const trigger = <Chip active={Boolean(applied.dateFrom)} className="h-11 shrink-0 gap-2 px-5"><CalendarDays className="h-4 w-4" />{label}</Chip>;

  if (!mobile) return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-[650px] p-5">{calendar(2)}<div className="mt-3 flex items-center justify-between gap-4"><p className="text-xs text-muted-foreground">Первый клик выбирает один день; второй завершает диапазон.</p><Button size="sm" disabled={!draft.from} onClick={() => { onApply({ whenPreset: null, dateFrom: draft.from, dateTo: draft.to }); setOpen(false); }}>Применить</Button></div></PopoverContent>
    </Popover>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="flex h-[92dvh] flex-col gap-0 rounded-t-3xl bg-white p-0">
        <div className="sticky top-0 z-10 border-b bg-white px-5 py-4"><SheetTitle>Выберите даты</SheetTitle><div className="mt-1 text-sm text-muted-foreground">{draft.from ? `${draft.from}${draft.to && draft.to !== draft.from ? ` — ${draft.to}` : ""}` : "Диапазон не выбран"}</div></div>
        <div className="flex gap-2 overflow-x-auto px-4 py-3">{(["TODAY", "TOMORROW", "WEEKEND"] as const).map((p) => <Chip key={p} onClick={() => applyPreset(p)}>{p === "TODAY" ? "Сегодня" : p === "TOMORROW" ? "Завтра" : "Выходные"}</Chip>)}</div>
        <div className="flex-1 space-y-8 overflow-y-auto px-4 pb-28">{Array.from({ length: 4 }, (_, i) => <div key={i}>{calendar(1, new Date(new Date().getFullYear(), new Date().getMonth() + i, 1))}</div>)}</div>
        <div className="sticky bottom-0 border-t bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"><div className="flex items-center gap-3"><MobileOverlayResetAction onClick={() => dispatch({ type: "reset" })} /><div className="min-w-0 flex-1" /><Button className="min-w-[10rem] shrink-0 rounded-full" disabled={!draft.from} onClick={() => { onApply({ whenPreset: null, dateFrom: draft.from, dateTo: draft.to }); setOpen(false); }}>Показать {resultCount ?? "…"} событий</Button></div></div>
      </SheetContent>
    </Sheet>
  );
}
