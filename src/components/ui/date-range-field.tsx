"use client";

import * as React from "react";
import { CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DateRangeFieldProps {
  /** Начало диапазона, `YYYY-MM-DD`. */
  from: string | null;
  /** Конец диапазона, `YYYY-MM-DD`. */
  to: string | null;
  onChange: (range: { from: string | null; to: string | null }) => void;
  placeholder?: string;
  disabled?: boolean;
  disablePast?: boolean;
  id?: string;
  className?: string;
  "aria-invalid"?: boolean;
}

function keyToDate(key: string | null): Date | null {
  if (!key) return null;
  const [year, month, day] = key.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
}

function dateToKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatRange(from: string | null, to: string | null): string | null {
  const start = keyToDate(from);
  if (!start) return null;
  const end = keyToDate(to);
  const fmt = (date: Date, withYear: boolean) =>
    date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
  if (!end) return `${fmt(start, false)} — …`;
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${fmt(start, !sameYear)} — ${fmt(end, true)}`;
}

/**
 * Диапазон дат одним полем: первый клик выбирает начало, второй — конец (клик раньше начала
 * начинает диапазон заново). Собран из `Popover` и `Calendar` в режиме диапазона.
 */
export function DateRangeField({
  from,
  to,
  onChange,
  placeholder = "Выберите даты",
  disabled = false,
  disablePast = false,
  id,
  className,
  "aria-invalid": ariaInvalid,
}: DateRangeFieldProps) {
  const [open, setOpen] = React.useState(false);
  const start = keyToDate(from);
  const end = keyToDate(to);
  const label = formatRange(from, to);

  const handlePick = (date: Date | null) => {
    if (!date) return;
    const key = dateToKey(date);
    // Диапазон завершён или ещё не начат — новый выбор начинает его заново.
    if (!from || to || key < from) {
      onChange({ from: key, to: null });
      return;
    }
    onChange({ from, to: key });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          data-invalid={ariaInvalid ? "true" : undefined}
          className={cn(
            "flex h-11 w-full items-center gap-2 rounded-xl border border-input bg-background px-3 text-left text-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            ariaInvalid && "border-red-500",
            !label && "text-muted-foreground",
            className,
          )}
        >
          <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{label ?? placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <Calendar
          size="compact"
          numberOfMonths={2}
          collapseToOneMonthOnMobile
          disablePast={disablePast}
          value={start}
          defaultMonth={start ?? undefined}
          rangeStart={start}
          rangeEnd={end}
          onChange={handlePick}
        />
      </PopoverContent>
    </Popover>
  );
}
