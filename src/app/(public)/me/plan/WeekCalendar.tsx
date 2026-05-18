"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setWeekStart(getWeekStart(selectedDate));
  }, [selectedDate]);

  // Auto-scroll selected day into view on mount and on selection change
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [selectedDate]);

  const weekDates = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const shiftWeek = (dir: 1 | -1) => {
    const next =
      dir === 1 ? getNextWeekStart(weekStart) : getPrevWeekStart(weekStart);
    setWeekStart(next);
    onSelect(preserveWeekday(selectedDate, next));
  };

  return (
    <div className="relative bg-white rounded-2xl border border-neutral-100 py-2.5">
      <button
        type="button"
        onClick={() => shiftWeek(-1)}
        className="absolute left-1 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        aria-label="Предыдущая неделя"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => shiftWeek(1)}
        className="absolute right-1 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        aria-label="Следующая неделя"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* Horizontal scrollable container */}
      <div className="overflow-x-auto scrollbar-hide px-10">
        <div className="flex gap-1 min-w-max">
          {weekDates.map((dateStr) => {
            const date = new Date(dateStr + "T12:00:00");
            const dayName = DAYS_RU[date.getDay()];
            const dayNum = date.getDate();
            const isToday = dateStr === todayISO;
            const isSelected = dateStr === selectedDate;
            const hasItems = (itemsByDate[dateStr]?.length ?? 0) > 0;
            const isPast = dateStr < todayISO;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

            return (
              <button
                key={dateStr}
                ref={isSelected ? selectedRef : undefined}
                type="button"
                disabled={isPast}
                onClick={() => onSelect(dateStr)}
                className={cn(
                  "relative flex flex-col items-center justify-center w-11 h-16 rounded-xl transition-all shrink-0",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759]/50",
                  isPast && !isSelected && "opacity-40 cursor-default",
                  isSelected
                    ? "bg-[#EF8759] text-white shadow-sm"
                    : isToday
                      ? "bg-[#FEF3EE] text-[#D56F47]"
                      : "hover:bg-neutral-50 text-neutral-700",
                )}
              >
                <span
                  className={cn(
                    "text-[10px] font-semibold mb-0.5 leading-none tracking-wide",
                    isSelected
                      ? "text-white/80"
                      : isToday
                        ? "text-[#D56F47]"
                        : isWeekend
                          ? "text-neutral-400"
                          : "text-neutral-500",
                  )}
                >
                  {dayName}
                </span>
                <span
                  className={cn(
                    "text-sm font-bold leading-none",
                    isSelected && "text-white",
                  )}
                >
                  {dayNum}
                </span>
                {hasItems && (
                  <div
                    className={cn(
                      "absolute bottom-1.5 w-1 h-1 rounded-full",
                      isSelected ? "bg-white/70" : "bg-[#EF8759]",
                    )}
                  />
                )}
                {isToday && !isSelected && (
                  <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-[#EF8759]/40" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
