"use client";

import { useMemo } from "react";
import { WeekCalendarStrip } from "@/features/my-plan/components/WeekCalendarStrip";
import type { SerializedPlanItem } from "./PlanPageClient";

type Props = {
  selectedDate: string;
  onSelect: (date: string) => void;
  itemsByDate: Record<string, SerializedPlanItem[]>;
  loading?: boolean;
};

export function WeekCalendar({ selectedDate, onSelect, itemsByDate, loading = false }: Props) {
  const plannedCountByDate = useMemo(
    () => Object.fromEntries(
      Object.entries(itemsByDate).map(([date, items]) => [date, items.length]),
    ),
    [itemsByDate],
  );

  return (
    <div className="relative">
      <WeekCalendarStrip
        selectedDate={selectedDate}
        onChangeDate={onSelect}
        showArrows={false}
        allowPastDates
        plannedCountByDate={plannedCountByDate}
      />
      {loading ? (
        <span
          role="status"
          className="pointer-events-none absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[11px] text-neutral-500 shadow-sm"
        >
          Обновляем…
        </span>
      ) : null}
    </div>
  );
}
