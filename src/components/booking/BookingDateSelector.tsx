"use client";

import { cn } from "@/lib/utils";
import type { BookingDateOption } from "./types";

interface BookingDateSelectorProps {
  dates: BookingDateOption[];
  selectedDateId: string | null;
  onSelectDate: (dateId: string) => void;
  className?: string;
}

export function BookingDateSelector({
  dates,
  selectedDateId,
  onSelectDate,
  className,
}: BookingDateSelectorProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-sm font-medium text-gray-900">Выберите дату</div>
      <div className="flex flex-wrap gap-2">
        {dates.map((date) => {
          const isSelected = date.id === selectedDateId;
          const isSoldOut = date.status === 'sold-out';
          
          return (
            <button
              key={date.id}
              type="button"
              onClick={() => !isSoldOut && onSelectDate(date.id)}
              disabled={isSoldOut}
              className={cn(
                "px-4 py-2.5 rounded-lg border text-sm font-medium transition-all",
                "hover:border-primary/50 active:scale-95",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-300",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white text-gray-700 border-gray-300",
                isSoldOut && "line-through"
              )}
            >
              {date.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
