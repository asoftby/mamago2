"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { FilterSelect } from "@/components/ui/filter-select";
import { getTodayStart } from "@/lib/date/getTodayStart";

export interface DatePickerProps {
  value?: Date | null;
  onDateChange?: (date: Date | null) => void;
  className?: string;
  disabled?: boolean;
  disablePast?: boolean;
  /** Ограничить выбор только этими датами (YYYY-MM-DD). */
  allowedDateKeys?: string[] | null;
  placeholder?: string;
  showAge?: boolean; // New prop to show age calculation
}

export function DatePicker({
  value,
  onDateChange,
  className,
  disabled = false,
  disablePast = true,
  allowedDateKeys = null,
  placeholder = "Выберите дату",
  showAge = false,
}: DatePickerProps) {
  const now = React.useMemo(() => new Date(), []);
  const todayStart = React.useMemo(() => getTodayStart(), []);
  const [month, setMonth] = React.useState(value?.getMonth() ?? now.getMonth());
  const [year, setYear] = React.useState(value?.getFullYear() ?? now.getFullYear());

  // Age calculation functions
  const calculateAge = (birthDate: Date): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let years = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      years--;
    }
    
    return years;
  };

  const formatAge = (years: number): string => {
    if (years === 0) return "меньше года";
    if (years === 1) return "1 год";
    if (years >= 2 && years <= 4) return `${years} года`;
    return `${years} лет`;
  };

  const allowedDateSet = React.useMemo(
    () => new Set((allowedDateKeys ?? []).filter(Boolean)),
    [allowedDateKeys],
  );
  const hasDateRestriction = allowedDateSet.size > 0;

  // Generate year options:
  // - default legacy behavior (birth-date-like range)
  // - if restricted dates are provided, derive years from them.
  const yearOptions = React.useMemo(() => {
    if (hasDateRestriction) {
      const years = new Set<number>();
      for (const key of allowedDateSet) {
        const [year] = key.split("-");
        const y = Number(year);
        if (Number.isFinite(y)) years.add(y);
      }
      const sorted = Array.from(years).sort((a, b) => a - b);
      if (sorted.length === 0) return [now.getFullYear()];
      return sorted;
    }
    const currentYear = now.getFullYear();
    const years = [];
    // For children, typically 0-18 years old, but allow up to 25 years back
    for (let y = currentYear; y >= currentYear - 25; y--) {
      years.push(y);
    }
    return years;
  }, [allowedDateSet, hasDateRestriction, now]);

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() === 0 ? 7 : firstDay.getDay()) - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const isPastDate = (day: number): boolean => {
    if (!disablePast) return false;
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    return date < todayStart;
  };

  const isBlockedByRestriction = (day: number): boolean => {
    if (!hasDateRestriction) return false;
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return !allowedDateSet.has(key);
  };

  const handleDateClick = (day: number) => {
    if (disabled || isPastDate(day) || isBlockedByRestriction(day)) return;
    const newDate = new Date(year, month, day);
    onDateChange?.(newDate);
  };

  const handleYearSelect = (v: string) => {
    const newYear = parseInt(v, 10);
    setYear(newYear);
    
    // If there's a selected date, maintain the day in the new year/month
    if (value) {
      const currentDay = value.getDate();
      const daysInNewMonth = new Date(newYear, month + 1, 0).getDate();
      const dayToSelect = Math.min(currentDay, daysInNewMonth);
      const newDate = new Date(newYear, month, dayToSelect);
      onDateChange?.(newDate);
    }
  };

  const handleMonthSelect = (v: string) => {
    const newMonth = parseInt(v, 10);
    setMonth(newMonth);
    
    // If there's a selected date, maintain the day in the new month/year
    if (value) {
      const currentDay = value.getDate();
      const daysInNewMonth = new Date(year, newMonth + 1, 0).getDate();
      const dayToSelect = Math.min(currentDay, daysInNewMonth);
      const newDate = new Date(year, newMonth, dayToSelect);
      onDateChange?.(newDate);
    }
  };

  // Generate month options
  const monthOptions = React.useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i,
      label: new Date(2024, i, 1).toLocaleDateString("ru-RU", { month: "long" })
    }));
  }, []);

  const isToday = (day: number) => {
    return (
      day === now.getDate() &&
      month === now.getMonth() &&
      year === now.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    if (!value) return false;
    return (
      day === value.getDate() &&
      month === value.getMonth() &&
      year === value.getFullYear()
    );
  };

  return (
    <div className={cn("w-full min-w-[320px]", className)}>
      {/* Selected Date Display */}
      {value && (
        <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="text-sm text-primary font-medium">
            Выбрана дата: {value.toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long", 
              year: "numeric"
            })}
            {showAge && (
              <span className="ml-2 text-primary/70">
                ({formatAge(calculateAge(value))})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="w-full rounded-lg pt-6 pb-3">
        {/* Month/Year Navigation */}
        <div className="flex items-center justify-center mb-7">
          <div className="flex items-center gap-2">
            <FilterSelect
              value={String(month)}
              options={monthOptions.map((m) => ({
                value: String(m.value),
                label: m.label,
              }))}
              onChange={handleMonthSelect}
              disabled={disabled}
              className="min-w-[140px]"
              selectClassName="!h-10 text-base font-medium"
              aria-label="Месяц"
            />

            <FilterSelect
              value={String(year)}
              options={yearOptions.map((y) => ({ value: String(y), label: String(y) }))}
              onChange={handleYearSelect}
              disabled={disabled}
              className="min-w-[90px]"
              selectClassName="!h-10 text-base font-medium"
              aria-label="Год"
            />
          </div>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 text-center text-sm text-gray-500 font-medium mb-3">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, i) => (
            <div key={i} className="py-2.5">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2.5">
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="h-11" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const today = isToday(day);
            const selected = isSelected(day);
            const past = isPastDate(day);
            const blocked = isBlockedByRestriction(day);

            return (
              <button
                key={day}
                type="button"
                className={cn(
                  "h-11 rounded-lg text-base font-medium transition-all",
                  "hover:bg-gray-100 active:scale-95",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent",
                  today && !selected && "ring-2 ring-primary/30 text-primary bg-primary/5",
                  selected && "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md",
                  (past || blocked) && "text-gray-300 cursor-not-allowed hover:bg-transparent"
                )}
                onClick={() => handleDateClick(day)}
                disabled={disabled || past || blocked}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}