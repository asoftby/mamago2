"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { ChipsRow } from "@/components/ui/chips-row";
import { EventDateRangePicker } from "./EventDateRangePicker";
import { HalloweenChip } from "./HalloweenChip";
import { DiscoveryWhoFilter } from "./DiscoveryWhoFilter";
import { useDiscoveryFilters, type WhenPreset } from "@/features/filters/discovery/filters.store";

const PRESETS: Array<{ value: Exclude<WhenPreset, null>; label: string }> = [
  { value: "TODAY", label: "Сегодня" },
  { value: "TOMORROW", label: "Завтра" },
  { value: "WEEKEND", label: "Выходные" },
];

export function EventQuickFilters({ halloweenEnabled = false }: { halloweenEnabled?: boolean }) {
  const { applied, actions } = useDiscoveryFilters();

  // Nearby has no executable proximity semantics yet. Clean old/shared URLs as
  // well as hiding the control so it can never remain a silent constraint.
  useEffect(() => {
    if (applied.nearby) actions.setDraft({ nearby: false });
  }, [actions, applied.nearby]);

  useEffect(() => {
    if (!halloweenEnabled && applied.occasionSlug) {
      actions.setDraft({ occasionSlug: null });
    }
  }, [halloweenEnabled, applied.occasionSlug, actions]);

  return (
    <div className="!mt-0 flex items-center gap-3 overflow-x-auto scroll-smooth pb-3 pt-0 [scrollbar-width:none]" aria-label="Быстрые фильтры событий">
      {halloweenEnabled && (
        <HalloweenChip
          active={applied.occasionSlug === "halloween"}
          onClick={() => actions.setDraft({ occasionSlug: applied.occasionSlug === "halloween" ? null : "halloween" })}
        />
      )}
      <DiscoveryWhoFilter />
      <ChipsRow
        className="contents [&>div]:contents"
        items={PRESETS.map((preset) => {
          const active = applied.whenPreset === preset.value;
          return {
            id: preset.value,
            label: (
              <span className="inline-flex items-center gap-2">
                {preset.label}
                {active && <X className="hidden h-3.5 w-3.5 md:block" aria-hidden="true" />}
              </span>
            ),
            active,
            onClick: () => actions.setDraft({ whenPreset: active ? null : preset.value, dateFrom: null, dateTo: null }),
          };
        })}
      />
      <EventDateRangePicker applied={applied} onApply={actions.setDraft} />
    </div>
  );
}
