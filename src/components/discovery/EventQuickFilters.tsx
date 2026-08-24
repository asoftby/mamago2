"use client";

import { useEffect } from "react";
import { Chip } from "@/components/ui/Chip";
import { ChipsRow } from "@/components/ui/chips-row";
import { EventDateRangePicker } from "./EventDateRangePicker";
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

  return (
    <div className="flex items-center gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]" aria-label="Быстрые фильтры событий">
      <ChipsRow className="contents" items={PRESETS.map((preset) => ({ id: preset.value, label: preset.label, active: applied.whenPreset === preset.value, onClick: () => actions.setDraft({ whenPreset: applied.whenPreset === preset.value ? null : preset.value }) }))} />
      <EventDateRangePicker applied={applied} onApply={actions.setDraft} />
    </div>
  );
}
