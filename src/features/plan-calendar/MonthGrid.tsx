"use client";

import { useState } from "react";
import {
  addMonths,
  dayOfMonth,
  monthMatrix,
  monthOf,
  startOfWeek,
  type DateKey,
} from "@/lib/date/dateKey";
import { monthYearLabel } from "./lib/labels";
import { ownerColor } from "./lib/ownerColor";
import type { PlanDayMarkers } from "./usePlanDayCounts";
import styles from "./plan-calendar.module.css";

const DOW = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

type Props = {
  value: DateKey;
  today: DateKey;
  markers: PlanDayMarkers;
  minDate?: DateKey;
  maxDate?: DateKey;
  onSelect: (d: DateKey) => void;
  onMonthChange?: (monthKey: DateKey) => void;
};

/** Expandable month (Monday first). Choosing a day selects it; the parent closes the grid. */
export function MonthGrid({ value, today, markers, minDate, maxDate, onSelect, onMonthChange }: Props) {
  const [cursor, setCursor] = useState<DateKey>(value);
  const matrix = monthMatrix(cursor);
  const currentWeek = startOfWeek(value);

  const move = (n: number) => {
    const next = addMonths(cursor, n);
    setCursor(next);
    onMonthChange?.(next);
  };

  return (
    <div className={styles.month} role="group" aria-label={monthYearLabel(cursor)}>
      <div className={styles.monthHead}>
        <button type="button" className={styles.arrow} onClick={() => move(-1)} aria-label="Предыдущий месяц">‹</button>
        <span className={styles.monthTitle}>{monthYearLabel(cursor)}</span>
        <button type="button" className={styles.arrow} onClick={() => move(1)} aria-label="Следующий месяц">›</button>
      </div>
      <div className={styles.monthGrid}>
        {DOW.map((d) => (
          <span key={d} className={styles.monthDow}>{d}</span>
        ))}
        {matrix.map((week) => (
          <div
            key={week[0]}
            className={`${styles.monthWeek} ${week[0] === currentWeek ? styles.monthWeekCurrent : ""}`}
          >
            {week.map((day) => {
              const owners = markers[day] ?? [];
              const disabled = (minDate && day < minDate) || (maxDate && day > maxDate);
              const cls = [
                styles.monthDay,
                monthOf(day) !== monthOf(cursor) ? styles.monthDayOther : "",
                day === today ? styles.monthDayToday : "",
                day === value ? styles.monthDaySelected : "",
              ].filter(Boolean).join(" ");
              return (
                <button
                  key={day}
                  type="button"
                  className={cls}
                  disabled={Boolean(disabled)}
                  aria-pressed={day === value}
                  aria-label={`${dayOfMonth(day)}.${String(monthOf(day)).padStart(2, "0")}, записей: ${owners.length}`}
                  onClick={() => onSelect(day)}
                >
                  {dayOfMonth(day)}
                  <span className={styles.monthDotSlot} aria-hidden>
                    {owners.length > 0 && (
                      <span
                        className={styles.monthDot}
                        style={day === value ? undefined : { background: ownerColor(owners[0]!) }}
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
