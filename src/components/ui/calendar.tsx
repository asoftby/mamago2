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
  /** Smaller typography and cells — use in tight popovers / wizards */
  size?: "default" | "compact";
  /** Number of consecutive months controlled by the same navigation state. */
  numberOfMonths?: 1 | 2;
  /** Keep a two-month calendar compact on small screens by hiding its second month. */
  collapseToOneMonthOnMobile?: boolean;
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
  size = "default",
  numberOfMonths = 1,
  collapseToOneMonthOnMobile = false,
}: CalendarProps) {
  const compact = size === "compact";
  const now = React.useMemo(() => new Date(), []);
  const todayStart = React.useMemo(() => getTodayStart(), []);
  
  // Use defaultMonth if provided, otherwise use value or current date
  const initialDate = defaultMonth || value || now;
  const [month, setMonth] = React.useState(initialDate.getMonth());
  const [year, setYear] = React.useState(initialDate.getFullYear());

  const formatMonthTitle = (date: Date) => {
    const title = date.toLocaleDateString("ru-RU", {
      month: "long",
      year: "numeric",
    });
    return title.charAt(0).toUpperCase() + title.slice(1);
  };

  const visibleMonths = Array.from({ length: numberOfMonths }, (_, index) =>
    new Date(year, month + index, 1)
  );

  const isPastDate = (day: number, displayMonth: number, displayYear: number): boolean => {
    if (!disablePast) return false;
    const date = new Date(displayYear, displayMonth, day);
    date.setHours(0, 0, 0, 0);
    return date < todayStart;
  };

  const isBeforeMinDate = (day: number, displayMonth: number, displayYear: number): boolean => {
    if (!minDate) return false;
    const date = new Date(displayYear, displayMonth, day);
    date.setHours(0, 0, 0, 0);
    const min = new Date(minDate);
    min.setHours(0, 0, 0, 0);
    return date <= min; // Cannot select date before or equal to minDate
  };

  const isInDisabledDates = (day: number, displayMonth: number, displayYear: number): boolean => {
    if (disabledDates.length === 0) return false;
    const date = new Date(displayYear, displayMonth, day);
    const isoDate = date.toISOString().split('T')[0];
    return disabledDates.includes(isoDate);
  };

  const isDisabledDate = (day: number, displayMonth: number, displayYear: number): boolean => {
    return isPastDate(day, displayMonth, displayYear)
      || isBeforeMinDate(day, displayMonth, displayYear)
      || isInDisabledDates(day, displayMonth, displayYear);
  };

  const handleDateClick = (day: number, displayMonth: number, displayYear: number) => {
    if (disabled || isDisabledDate(day, displayMonth, displayYear)) return;
    const newDate = new Date(displayYear, displayMonth, day);
    
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

  const isToday = (day: number, displayMonth: number, displayYear: number) => {
    return (
      day === now.getDate() &&
      displayMonth === now.getMonth() &&
      displayYear === now.getFullYear()
    );
  };

  const isSelected = (day: number, displayMonth: number, displayYear: number) => {
    if (mode === 'multiple') {
      const date = new Date(displayYear, displayMonth, day);
      const dateStr = date.toISOString().split('T')[0];
      return selectedDates.some(d => {
        const dStr = d.toISOString().split('T')[0];
        return dStr === dateStr;
      });
    }
    
    if (!value) return false;
    return (
      day === value.getDate() &&
      displayMonth === value.getMonth() &&
      displayYear === value.getFullYear()
    );
  };
  
  const isInRange = (day: number, displayMonth: number, displayYear: number) => {
    if (!rangeStart || !rangeEnd) return false;
    const date = new Date(displayYear, displayMonth, day);
    date.setHours(0, 0, 0, 0);
    const start = new Date(rangeStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(rangeEnd);
    end.setHours(0, 0, 0, 0);
    return date >= start && date <= end;
  };
  
  const isRangeStart = (day: number, displayMonth: number, displayYear: number) => {
    if (!rangeStart) return false;
    return (
      day === rangeStart.getDate() &&
      displayMonth === rangeStart.getMonth() &&
      displayYear === rangeStart.getFullYear()
    );
  };
  
  const isRangeEnd = (day: number, displayMonth: number, displayYear: number) => {
    if (!rangeEnd) return false;
    return (
      day === rangeEnd.getDate() &&
      displayMonth === rangeEnd.getMonth() &&
      displayYear === rangeEnd.getFullYear()
    );
  };

  return (
    <div
      className={cn(
        "bg-white w-full",
        compact ? "space-y-2" : "space-y-5",
        className
      )}
    >
      <div className={cn("grid gap-6", numberOfMonths === 2 && "sm:grid-cols-2")}>
      {visibleMonths.map((visibleMonth, index) => {
        const displayMonth = visibleMonth.getMonth();
        const displayYear = visibleMonth.getFullYear();
        const firstDay = new Date(displayYear, displayMonth, 1);
        const startOffset = (firstDay.getDay() === 0 ? 7 : firstDay.getDay()) - 1;
        const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();

        return (
        <div
          key={`${displayYear}-${displayMonth}`}
          className={cn(
            compact ? "space-y-2" : "space-y-5",
            index === 1 && collapseToOneMonthOnMobile && "hidden sm:block"
          )}
        >
      {/* Month Navigation */}
      <div className="flex items-center justify-between px-0.5">
        <button
          type="button"
          onClick={handlePrevMonth}
          disabled={disabled}
          aria-label="Предыдущий месяц"
          className={cn(
            "rounded-full hover:bg-muted/40 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
            compact ? "h-8 w-8" : "h-11 w-11",
            index > 0 && "invisible"
          )}
        >
          <ChevronLeft className={compact ? "h-4 w-4" : "h-6 w-6"} />
        </button>
        <div
          className={cn(
            "font-semibold",
            compact ? "text-sm leading-tight" : "text-xl"
          )}
        >
          {formatMonthTitle(visibleMonth)}
        </div>
        <button
          type="button"
          onClick={handleNextMonth}
          disabled={disabled}
          aria-label="Следующий месяц"
          className={cn(
            "rounded-full hover:bg-muted/40 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
            compact ? "h-8 w-8" : "h-11 w-11",
            index < numberOfMonths - 1 && "invisible",
            collapseToOneMonthOnMobile && index === 0 && numberOfMonths === 2 && "visible sm:invisible"
          )}
        >
          <ChevronRight className={compact ? "h-4 w-4" : "h-6 w-6"} />
        </button>
      </div>

      {/* Weekday Headers */}
      <div
        className={cn(
          "grid grid-cols-7 text-center text-muted-foreground font-medium",
          compact ? "text-[11px] leading-none" : "text-base"
        )}
      >
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, i) => (
          <div key={i} className={compact ? "py-0.5" : "py-2"}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className={cn("grid grid-cols-7", compact ? "gap-0.5" : "gap-2")}>
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} className={compact ? "h-8" : "h-14"} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const today = isToday(day, displayMonth, displayYear);
          const selected = isSelected(day, displayMonth, displayYear);
          const dateDisabled = isDisabledDate(day, displayMonth, displayYear);
          const inRange = isInRange(day, displayMonth, displayYear);
          const rangeStartDay = isRangeStart(day, displayMonth, displayYear);
          const rangeEndDay = isRangeEnd(day, displayMonth, displayYear);

          return (
            <button
              key={day}
              type="button"
              className={cn(
                "font-medium transition-all",
                compact
                  ? "h-8 rounded-md text-xs"
                  : "h-14 rounded-xl text-lg",
                "hover:bg-muted/50 active:scale-95",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent",
                today && !selected && !rangeStartDay && !rangeEndDay && "ring-1 ring-primary/30 text-primary",
                (selected || rangeStartDay || rangeEndDay) && "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
                inRange && !rangeStartDay && !rangeEndDay && "bg-primary/10 text-primary",
                dateDisabled && "text-gray-300 cursor-not-allowed hover:bg-transparent"
              )}
              onClick={() => handleDateClick(day, displayMonth, displayYear)}
              disabled={disabled || dateDisabled}
            >
              {day}
            </button>
          );
        })}
      </div>
        </div>
        );
      })}
      </div>
    </div>
  );
}
