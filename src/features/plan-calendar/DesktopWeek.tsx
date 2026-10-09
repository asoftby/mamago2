"use client";

import { useState } from "react";
import type { DateKey } from "@/lib/date/dateKey";
import { DayCell } from "./DayCell";
import { MonthGrid } from "./MonthGrid";
import { weekHeaderLabel } from "./lib/labels";
import type { PlanDayMarkers } from "./usePlanDayCounts";
import type { usePlanCalendar } from "./usePlanCalendar";
import styles from "./plan-calendar.module.css";

type Props = {
  value: DateKey;
  variant: "widget" | "page";
  markers: PlanDayMarkers;
  minDate?: DateKey;
  maxDate?: DateKey;
  calendar: ReturnType<typeof usePlanCalendar>;
  /** Month shown in the open month grid (null when closed): lets the parent load its markers. */
  onMonthView?: (month: DateKey | null) => void;
};

/** Week row with arrows; the page variant also has «← ПРЕД / СЛЕД →». Header month opens the month grid. */
export function DesktopWeek({ value, variant, markers, minDate, maxDate, calendar, onMonthView }: Props) {
  const { today, weekStart, days, select, shiftWeek, goToday, onKeyDown, canShiftBack, canShiftForward } = calendar;
  const [monthOpen, setMonthOpen] = useState(false);
  // Slide direction of the last week change (0 until the first change).
  const [slide, setSlide] = useState<{ week: DateKey; dir: 0 | 1 | -1 }>({ week: weekStart, dir: 0 });
  if (slide.week !== weekStart) {
    setSlide({ week: weekStart, dir: weekStart > slide.week ? 1 : -1 });
  }
  const lastDir = slide.dir;

  const isPage = variant === "page";
  const todayDisabled = value === today;

  return (
    <>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.monthLabel}
          aria-expanded={monthOpen}
          onClick={() => {
            setMonthOpen((o) => !o);
            onMonthView?.(monthOpen ? null : value);
          }}
        >
          {weekHeaderLabel(days)}
          <span aria-hidden>{monthOpen ? "▴" : "▾"}</span>
        </button>
        <span className={styles.rule} />
        {isPage && (
          <>
            <button type="button" className={styles.textNav} onClick={() => shiftWeek(-1)} disabled={!canShiftBack}>← пред</button>
            <button type="button" className={styles.textNav} onClick={() => shiftWeek(1)} disabled={!canShiftForward}>след →</button>
          </>
        )}
        <button type="button" className={styles.todayPill} onClick={goToday} disabled={todayDisabled}>Сегодня</button>
      </div>

      {monthOpen && (
        <MonthGrid
          value={value}
          today={today}
          markers={markers}
          minDate={minDate}
          maxDate={maxDate}
          onMonthChange={(m) => onMonthView?.(m)}
          onSelect={(d) => {
            select(d);
            setMonthOpen(false);
            onMonthView?.(null);
          }}
        />
      )}

      <div className={`${styles.row} ${isPage ? "" : styles.rowCompact}`}>
        <button type="button" className={styles.arrow} onClick={() => shiftWeek(-1)} disabled={!canShiftBack} aria-label="Предыдущая неделя">‹</button>
        <div
          key={weekStart}
          role="tablist"
          aria-label="Дни недели"
          className={`${styles.days} ${lastDir !== 0 ? styles.weekAnim : ""}`}
          data-dir={lastDir}
          onKeyDown={onKeyDown}
        >
          {days.map((day) => (
            <DayCell
              key={day}
              dateKey={day}
              today={today}
              selected={day === value}
              owners={markers[day] ?? []}
              variant="desktop"
              tabIndex={day === value ? 0 : -1}
              onSelect={select}
            />
          ))}
        </div>
        <button type="button" className={styles.arrow} onClick={() => shiftWeek(1)} disabled={!canShiftForward} aria-label="Следующая неделя">›</button>
      </div>
    </>
  );
}
