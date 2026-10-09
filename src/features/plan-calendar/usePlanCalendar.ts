"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { addDays, startOfWeek, todayKey, weekDays, type DateKey } from "@/lib/date/dateKey";

type Options = {
  value: DateKey;
  onChange: (d: DateKey) => void;
  minDate?: DateKey;
  maxDate?: DateKey;
  /** Called when the selection moved by keyboard, so the caller can restore focus. */
  onKeyboardMove?: () => void;
};

/** Selection/navigation state shared by all calendar modes. Selection itself is owned by the caller (`value`). */
export function usePlanCalendar({ value, onChange, minDate, maxDate, onKeyboardMove }: Options) {
  const [today, setToday] = useState<DateKey>(() => todayKey());

  useEffect(() => {
    const refresh = () => setToday(todayKey());
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const clamp = useCallback(
    (key: DateKey): DateKey => {
      if (minDate && key < minDate) return minDate;
      if (maxDate && key > maxDate) return maxDate;
      return key;
    },
    [minDate, maxDate],
  );

  const select = useCallback(
    (key: DateKey) => {
      const next = clamp(key);
      if (next !== value) onChange(next);
    },
    [clamp, onChange, value],
  );

  const weekStart = useMemo(() => startOfWeek(value), [value]);
  const days = useMemo(() => weekDays(value), [value]);

  /** Weekday is preserved: Thu stays Thu on the next week. */
  const shiftWeek = useCallback((dir: 1 | -1) => select(addDays(value, dir * 7)), [select, value]);
  const shiftDay = useCallback((dir: 1 | -1) => select(addDays(value, dir)), [select, value]);
  const goToday = useCallback(() => select(today), [select, today]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      let next: DateKey | null = null;
      if (e.key === "ArrowLeft") next = addDays(value, -1);
      else if (e.key === "ArrowRight") next = addDays(value, 1);
      else if (e.key === "PageUp") next = addDays(value, -7);
      else if (e.key === "PageDown") next = addDays(value, 7);
      else if (e.key === "Home") next = today;
      if (!next) return;
      e.preventDefault();
      onKeyboardMove?.();
      select(next);
    },
    [onKeyboardMove, select, today, value],
  );

  return {
    today,
    weekStart,
    days,
    clamp,
    select,
    shiftWeek,
    shiftDay,
    goToday,
    onKeyDown,
    canShiftBack: !minDate || addDays(weekStart, -1) >= minDate,
    canShiftForward: !maxDate || addDays(weekStart, 7) <= maxDate,
  };
}
