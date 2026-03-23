"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getTodayStart } from "@/lib/date/getTodayStart";

export interface DateTimePickerProps {
  value?: Date | null;
  time?: string | null;
  onDateChange?: (date: Date | null) => void;
  onTimeChange?: (time: string) => void;
  minTime?: string;
  maxTime?: string;
  step?: number;
  className?: string;
  disabled?: boolean;
  disablePast?: boolean;
  labels?: {
    time?: string;
    placeholder?: string;
  };
  /** Только календарь без выбора времени (паттерн из ui-lab / date-time-picker) */
  dateOnly?: boolean;
}

function generateTimeSlots(step: number = 15, minTime?: string, maxTime?: string): string[] {
  const slots: string[] = [];
  const totalMinutes = 24 * 60;
  
  for (let minutes = 0; minutes < totalMinutes; minutes += step) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    slots.push(timeStr);
  }
  
  // Filter by min/max if provided
  if (minTime || maxTime) {
    return slots.filter(slot => {
      if (minTime && slot < minTime) return false;
      if (maxTime && slot > maxTime) return false;
      return true;
    });
  }
  
  return slots;
}

export function DateTimePicker({
  value,
  time,
  onDateChange,
  onTimeChange,
  minTime,
  maxTime,
  step = 15,
  className,
  disabled = false,
  disablePast = true,
  labels = {},
  dateOnly = false,
}: DateTimePickerProps) {
  const now = React.useMemo(() => new Date(), []);
  const todayStart = React.useMemo(() => getTodayStart(), []);
  const [month, setMonth] = React.useState(value?.getMonth() ?? now.getMonth());
  const [year, setYear] = React.useState(value?.getFullYear() ?? now.getFullYear());

  React.useEffect(() => {
    if (value) {
      setMonth(value.getMonth());
      setYear(value.getFullYear());
    }
  }, [value]);
  
  const timeSlots = React.useMemo(
    () => generateTimeSlots(step, minTime, maxTime),
    [step, minTime, maxTime]
  );

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
    if (!value) return false;
    return (
      day === value.getDate() &&
      month === value.getMonth() &&
      year === value.getFullYear()
    );
  };

  const hasDateSelected = !!value;

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Calendar Section */}
      <div className="space-y-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            className="h-10 w-10 rounded-full hover:bg-muted/40 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handlePrevMonth}
            disabled={disabled}
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-lg font-semibold">
            {new Date(year, month, 1).toLocaleDateString("ru-RU", {
              month: "long",
              year: "numeric",
            })}
          </div>
          <button
            type="button"
            className="h-10 w-10 rounded-full hover:bg-muted/40 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleNextMonth}
            disabled={disabled}
            aria-label="Следующий месяц"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 text-center text-sm text-muted-foreground font-medium">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, i) => (
            <div key={i} className="py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="h-11" />
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
                  "h-11 rounded-xl text-base font-medium transition-all",
                  "hover:bg-muted/50 active:scale-95",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent",
                  today && !selected && "ring-1 ring-primary/30 text-primary",
                  selected && "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
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

      {!dateOnly ? (
        <div className="space-y-3 border-t border-border/40 pt-2">
          <label className="text-sm font-medium text-foreground">
            {labels.time || "Время"}
          </label>
          <Select
            value={time || undefined}
            onValueChange={onTimeChange}
            disabled={disabled || !hasDateSelected}
          >
            <SelectTrigger
              className={cn(
                "h-14 w-full rounded-2xl border-2 text-base font-medium",
                "shadow-sm transition-all",
                !hasDateSelected && "cursor-not-allowed opacity-50",
                time && "border-primary/30 bg-primary/5",
              )}
              style={{ backgroundColor: time ? undefined : "white" }}
            >
              <SelectValue placeholder={labels.placeholder || "Выберите время"} />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] bg-white">
              {timeSlots.map((slot) => (
                <SelectItem
                  key={slot}
                  value={slot}
                  className="cursor-pointer py-3 text-base"
                >
                  {slot}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!hasDateSelected && (
            <p className="text-xs text-muted-foreground">
              Сначала выберите дату
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
