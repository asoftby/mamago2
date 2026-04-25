"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getNextWeekStart,
  getPrevWeekStart,
  getWeekDays,
  getWeekStart,
  isoFromDate,
  preserveWeekday,
} from "@/features/my-plan/lib/weekCalendar";
import type { SerializedPlanItem } from "./PlanPageClient";

const DAYS_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

type Props = {
  selectedDate: string;
  onSelect: (date: string) => void;
  itemsByDate: Record<string, SerializedPlanItem[]>;
};

export function WeekCalendar({ selectedDate, onSelect, itemsByDate }: Props) {
  const todayISO = isoFromDate(new Date());
  const [weekStart, setWeekStart] = useState(() => getWeekStart(selectedDate));

  useEffect(() => {
    setWeekStart(getWeekStart(selectedDate));
  }, [selectedDate]);

  const weekDates = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const shiftWeek = (dir: 1 | -1) => {
    const next =
      dir === 1 ? getNextWeekStart(weekStart) : getPrevWeekStart(weekStart);
    setWeekStart(next);
    onSelect(preserveWeekday(selectedDate, next));
  };

  return (
    <div className="relative bg-white rounded-2xl border border-neutral-100 p-3">
      <button
        type="button"
        onClick={() => shiftWeek(-1)}
        className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        aria-label="Предыдущая неделя"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => shiftWeek(1)}
        className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        aria-label="Следующая неделя"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      <div className="grid grid-cols-7 gap-1 px-9">
        {weekDates.map((dateStr) => {
          const date = new Date(dateStr + "T12:00:00");
          const dayName = DAYS_RU[date.getDay()];
          const dayNum = date.getDate();
          const isToday = dateStr === todayISO;
          const isSelected = dateStr === selectedDate;
          const hasItems = (itemsByDate[dateStr]?.length ?? 0) > 0;
          const isPast = dateStr < todayISO;

          return (
            <button
              key={dateStr}
              type="button"
              aria-disabled={isPast}
              onClick={() => onSelect(dateStr)}
              className={cn(
                "relative flex flex-col items-center justify-center py-2.5 px-1 rounded-xl transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20",
                isPast && !isSelected && "opacity-45",
                isPast && !isSelected && "hover:bg-transparent",
                isSelected
                  ? "bg-neutral-900 text-white"
                  : isToday
                    ? "bg-neutral-100 text-neutral-900"
                    : !isPast && "hover:bg-neutral-50 text-neutral-700",
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-medium mb-1 leading-none",
                  isSelected ? "text-white/70" : "text-neutral-400",
                )}
              >
                {dayName}
              </span>
              <span
                className={cn(
                  "text-sm font-bold leading-none",
                  isSelected
                    ? "text-white"
                    : isToday
                      ? "text-neutral-900"
                      : "text-neutral-700",
                )}
              >
                {dayNum}
              </span>
              {hasItems && (
                <div
                  className={cn(
                    "absolute bottom-1.5 w-1 h-1 rounded-full",
                    isSelected ? "bg-white/60" : "bg-neutral-900",
                  )}
                />
              )}
              {isToday && !isSelected && (
                <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-neutral-300" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
