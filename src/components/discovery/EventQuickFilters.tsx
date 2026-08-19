"use client";

import { useEffect } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDiscoveryFilters, type WhenPreset } from "@/features/filters/discovery/filters.store";

const PRESETS: Array<{ value: Exclude<WhenPreset, null>; label: string }> = [
  { value: "TODAY", label: "Сегодня" },
  { value: "TOMORROW", label: "Завтра" },
  { value: "WEEKEND", label: "Выходные" },
];

export function EventQuickFilters() {
  const { applied, actions } = useDiscoveryFilters();

  // Nearby has no executable proximity semantics yet. Clean old/shared URLs as
  // well as hiding the control so it can never remain a silent constraint.
  useEffect(() => {
    if (applied.nearby) actions.setDraft({ nearby: false });
  }, [actions, applied.nearby]);

  const chipClass = (active: boolean) =>
    cn(
      "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition-colors",
      active
        ? "border-neutral-900 bg-neutral-900 text-white"
        : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400",
    );

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Быстрые фильтры событий">
      {PRESETS.map((preset) => (
        <button
          key={preset.value}
          type="button"
          className={chipClass(applied.whenPreset === preset.value)}
          aria-pressed={applied.whenPreset === preset.value}
          onClick={() =>
            actions.setDraft({
              whenPreset: applied.whenPreset === preset.value ? null : preset.value,
            })
          }
        >
          {preset.label}
        </button>
      ))}

      <label className={cn(chipClass(Boolean(applied.dateFrom)), "relative cursor-pointer gap-2") }>
        <CalendarDays className="h-4 w-4" />
        <span>{applied.dateFrom ? new Intl.DateTimeFormat("ru-BY", { day: "numeric", month: "short" }).format(new Date(`${applied.dateFrom}T12:00:00`)) : "Выбрать дату"}</span>
        <input
          type="date"
          value={applied.dateFrom ?? ""}
          aria-label="Выбрать дату"
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(event) => actions.setDraft({ dateFrom: event.target.value || null, dateTo: null })}
        />
      </label>

      <button
        type="button"
        className={chipClass(applied.free)}
        aria-pressed={applied.free}
        onClick={() => actions.setDraft({ free: !applied.free })}
      >
        Бесплатно
      </button>
    </div>
  );
}
