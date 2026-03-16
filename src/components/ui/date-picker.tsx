"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { getTodayStart } from "@/lib/date/getTodayStart";

export interface DatePickerProps {
  value?: Date | null;
  onDateChange?: (date: Date | null) => void;
  className?: string;
  disabled?: boolean;
  disablePast?: boolean;
  placeholder?: string;
  showAge?: boolean; // New prop to show age calculation
}

export function DatePicker({
  value,
  onDateChange,
  className,
  disabled = false,
  disablePast = true,
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

  // Generate year options (from current year - 25 to current year for children)
  const yearOptions = React.useMemo(() => {
    const currentYear = now.getFullYear();
    const years = [];
    // For children, typically 0-18 years old, but allow up to 25 years back
    for (let y = currentYear; y >= currentYear - 25; y--) {
      years.push(y);
    }
    return years;
  }, [now]);

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() === 0 ? 7 : firstDay.getDay()) - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const isPastDate = (day: number): boolean => {
    if (!disablePast) return false;
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    return date < todayStart;
  };

  const handleDateClick = (day: number) => {
    if (disabled || isPastDate(day)) return;
    const newDate = new Date(year, month, day);
    onDateChange?.(newDate);
  };

  const handleYearSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value);
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

  const handleMonthSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value);
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
    <div className={cn("w-full", className)}>
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
      <div className="w-full bg-white rounded-lg">
        {/* Month/Year Navigation */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-2">
            {/* Month dropdown */}
            <div className="relative">
              <select
                value={month}
                onChange={handleMonthSelect}
                disabled={disabled}
                className="px-3 py-1 text-base font-medium bg-white border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 cursor-pointer appearance-none pr-8 min-w-[120px]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 8px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px'
                }}
              >
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Year dropdown */}
            <div className="relative">
              <select
                value={year}
                onChange={handleYearSelect}
                disabled={disabled}
                className="px-3 py-1 text-base font-medium bg-white border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 cursor-pointer appearance-none pr-8 min-w-[80px]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 8px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px'
                }}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 text-center text-xs text-gray-500 font-medium mb-3">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, i) => (
            <div key={i} className="py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="h-9" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const today = isToday(day);
            const selected = isSelected(day);
            const past = isPastDate(day);

            return (
              <button
                key={day}
                type="button"
                className={cn(
                  "h-9 rounded-lg text-sm font-medium transition-all",
                  "hover:bg-gray-100 active:scale-95",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent",
                  today && !selected && "ring-2 ring-primary/30 text-primary bg-primary/5",
                  selected && "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md",
                  past && "text-gray-300 cursor-not-allowed hover:bg-transparent"
                )}
                onClick={() => handleDateClick(day)}
                disabled={disabled || past}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {!value && (
        <div className="mt-2 text-xs text-gray-500">
          {placeholder}
        </div>
      )}
    </div>
  );
}