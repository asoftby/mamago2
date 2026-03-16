"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTodayStart } from "@/lib/date/getTodayStart";

export interface CalendarProps {
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  className?: string;
  disabled?: boolean;
  disablePast?: boolean;
  defaultMonth?: Date;
  rangeStart?: Date | null; // For range selection
  rangeEnd?: Date | null; // For range selection
  minDate?: Date | null; // Minimum selectable date (for range end selection)
  disabledDates?: string[]; // Array of ISO date strings to disable (YYYY-MM-DD)
  mode?: 'single' | 'multiple'; // Selection mode
  selectedDates?: Date[]; // For multiple selection mode
  onMultipleChange?: (dates: Date[]) => void; // Callback for multiple selection
}

export function Calendar({
  value,
  onChange,
  className,
  disabled = false,
  disablePast = true,
  defaultMonth,
  rangeStart,
  rangeEnd,
  minDate,
  disabledDates = [],
  mode = 'single',
  selectedDates = [],
  onMultipleChange,
}: CalendarProps) {
  const now = React.useMemo(() => new Date(), []);
  const todayStart = React.useMemo(() => getTodayStart(), []);
  
  // Use defaultMonth if provided, otherwise use value or current date
  const initialDate = defaultMonth || value || now;
  const [month, setMonth] = React.useState(initialDate.getMonth());
  const [year, setYear] = React.useState(initialDate.getFullYear());

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() === 0 ? 7 : firstDay.getDay()) - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const isPastDate = (day: number): boolean => {
    if (!disablePast) return false;
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    return date < todayStart;
  };

  const isBeforeMinDate = (day: number): boolean => {
    if (!minDate) return false;
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    const min = new Date(minDate);
    min.setHours(0, 0, 0, 0);
    return date <= min; // Cannot select date before or equal to minDate
  };

  const isInDisabledDates = (day: number): boolean => {
    if (disabledDates.length === 0) return false;
    const date = new Date(year, month, day);
    const isoDate = date.toISOString().split('T')[0];
    return disabledDates.includes(isoDate);
  };

  const isDisabledDate = (day: number): boolean => {
    return isPastDate(day) || isBeforeMinDate(day) || isInDisabledDates(day);
  };

  const handleDateClick = (day: number) => {
    if (disabled || isDisabledDate(day)) return;
    const newDate = new Date(year, month, day);
    
    if (mode === 'multiple') {
      // Toggle date in multiple selection
      const dateStr = newDate.toISOString().split('T')[0];
      const isAlreadySelected = selectedDates.some(d => {
        const dStr = d.toISOString().split('T')[0];
        return dStr === dateStr;
      });
      
      let updatedDates: Date[];
      if (isAlreadySelected) {
        updatedDates = selectedDates.filter(d => {
          const dStr = d.toISOString().split('T')[0];
          return dStr !== dateStr;
        });
      } else {
        updatedDates = [...selectedDates, newDate];
      }
      
      onMultipleChange?.(updatedDates);
    } else {
      onChange?.(newDate);
    }
  };

  const handlePrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const isToday = (day: number) => {
    return (
      day === now.getDate() &&
      month === now.getMonth() &&
      year === now.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    if (mode === 'multiple') {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      return selectedDates.some(d => {
        const dStr = d.toISOString().split('T')[0];
        return dStr === dateStr;
      });
    }
    
    if (!value) return false;
    return (
      day === value.getDate() &&
      month === value.getMonth() &&
      year === value.getFullYear()
    );
  };
  
  const isInRange = (day: number) => {
    if (!rangeStart || !rangeEnd) return false;
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    const start = new Date(rangeStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(rangeEnd);
    end.setHours(0, 0, 0, 0);
    return date >= start && date <= end;
  };
  
  const isRangeStart = (day: number) => {
    if (!rangeStart) return false;
    return (
      day === rangeStart.getDate() &&
      month === rangeStart.getMonth() &&
      year === rangeStart.getFullYear()
    );
  };
  
  const isRangeEnd = (day: number) => {
    if (!rangeEnd) return false;
    return (
      day === rangeEnd.getDate() &&
      month === rangeEnd.getMonth() &&
      year === rangeEnd.getFullYear()
    );
  };

  return (
    <div className={cn("space-y-5 bg-white w-full", className)}>
      {/* Month Navigation */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          className="h-11 w-11 rounded-full hover:bg-muted/40 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handlePrevMonth}
          disabled={disabled}
          aria-label="Предыдущий месяц"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="text-xl font-semibold">
          {new Date(year, month, 1).toLocaleDateString("ru-RU", {
            month: "long",
            year: "numeric",
          })}
        </div>
        <button
          type="button"
          className="h-11 w-11 rounded-full hover:bg-muted/40 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleNextMonth}
          disabled={disabled}
          aria-label="Следующий месяц"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 text-center text-base text-muted-foreground font-medium">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, i) => (
          <div key={i} className="py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="h-14" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const today = isToday(day);
          const selected = isSelected(day);
          const dateDisabled = isDisabledDate(day);
          const inRange = isInRange(day);
          const rangeStartDay = isRangeStart(day);
          const rangeEndDay = isRangeEnd(day);

          return (
            <button
              key={day}
              type="button"
              className={cn(
                "h-14 rounded-xl text-lg font-medium transition-all",
                "hover:bg-muted/50 active:scale-95",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent",
                today && !selected && !rangeStartDay && !rangeEndDay && "ring-1 ring-primary/30 text-primary",
                (selected || rangeStartDay || rangeEndDay) && "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
                inRange && !rangeStartDay && !rangeEndDay && "bg-primary/10 text-primary",
                dateDisabled && "text-gray-300 cursor-not-allowed hover:bg-transparent"
              )}
              onClick={() => handleDateClick(day)}
              disabled={disabled || dateDisabled}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
