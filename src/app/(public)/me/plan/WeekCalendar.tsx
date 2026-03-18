"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { SerializedPlanItem } from "./PlanPageClient";

const DAYS_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function getWeekDates(): string[] {
  const today = new Date();
  const day = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7)); // shift to Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

type Props = {
  selectedDate: string;
  onSelect: (date: string) => void;
  itemsByDate: Record<string, SerializedPlanItem[]>;
};

export function WeekCalendar({ selectedDate, onSelect, itemsByDate }: Props) {
  const todayISO = new Date().toISOString().split("T")[0];
  const weekDates = useMemo(() => getWeekDates(), []);

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 p-3">
      <div className="grid grid-cols-7 gap-1">
        {weekDates.map((dateStr) => {
          const date = new Date(dateStr + "T00:00:00");
          const dayName = DAYS_RU[date.getDay()];
          const dayNum = date.getDate();
          const isToday = dateStr === todayISO;
          const isSelected = dateStr === selectedDate;
          const hasItems = (itemsByDate[dateStr]?.length ?? 0) > 0;
          const count = itemsByDate[dateStr]?.length ?? 0;

          return (
            <button
              key={dateStr}
              onClick={() => onSelect(dateStr)}
              className={cn(
                "relative flex flex-col items-center justify-center py-2.5 px-1 rounded-xl transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20",
                isSelected
                  ? "bg-neutral-900 text-white"
                  : isToday
                  ? "bg-neutral-100 text-neutral-900"
                  : "hover:bg-neutral-50 text-neutral-700"
              )}
            >
              <span className={cn(
                "text-[10px] font-medium mb-1 leading-none",
                isSelected ? "text-white/70" : "text-neutral-400"
              )}>
                {dayName}
              </span>
              <span className={cn(
                "text-sm font-bold leading-none",
                isSelected ? "text-white" : isToday ? "text-neutral-900" : "text-neutral-700"
              )}>
                {dayNum}
              </span>
              {/* Dot indicator */}
              {hasItems && (
                <div className={cn(
                  "absolute bottom-1.5 w-1 h-1 rounded-full",
                  isSelected ? "bg-white/60" : "bg-neutral-900"
                )} />
              )}
              {/* Today ring */}
              {isToday && !isSelected && (
                <div className="absolute inset-0 rounded-xl ring-1 ring-neutral-300 pointer-events-none" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
