"use client";

import { useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import { normalizeClosedDates } from "@/lib/offers/offerSchedule";

interface ClosedDaysCalendarProps {
  /** Закрытые даты, `YYYY-MM-DD`. */
  value: string[];
  onChange: (dates: string[]) => void;
  disabled?: boolean;
}

/** Локальная полночь для даты `YYYY-MM-DD` (так же, как строит даты сам Calendar). */
function keyToDate(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateToKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatKey(key: string): string {
  return keyToDate(key).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/** Календарь месяца: клик закрывает день, повторный клик открывает. Список закрытых дат — чипами. */
export function ClosedDaysCalendar({ value, onChange, disabled = false }: ClosedDaysCalendarProps) {
  const selectedDates = useMemo(() => value.map(keyToDate), [value]);

  const chips: ChipItem[] = value.map((key) => ({
    id: key,
    label: `${formatKey(key)} ✕`,
    active: true,
    disabled,
    onClick: () => onChange(value.filter((item) => item !== key)),
  }));

  return (
    <div className="space-y-3">
      <Calendar
        mode="multiple"
        size="compact"
        disabled={disabled}
        selectedDates={selectedDates}
        onMultipleChange={(dates) => onChange(normalizeClosedDates(dates.map(dateToKey)))}
      />
      {chips.length > 0 ? (
        <ChipsRow items={chips} layout="wrap" aria-label="Закрытые даты" />
      ) : (
        <p className="text-sm text-muted-foreground">Закрытых дат нет.</p>
      )}
    </div>
  );
}
