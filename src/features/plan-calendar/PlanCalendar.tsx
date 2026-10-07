"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { monthMatrix, type DateKey } from "@/lib/date/dateKey";
import { DesktopWeek } from "./DesktopWeek";
import { MobileStrip } from "./MobileStrip";
import { usePlanCalendar } from "./usePlanCalendar";
import { usePlanDayCounts } from "./usePlanDayCounts";
import styles from "./plan-calendar.module.css";

export type PlanCalendarProps = {
  value: DateKey;
  onChange: (d: DateKey) => void;
  /** widget: compact, no «ПРЕД/СЛЕД»; page: full. */
  variant: "widget" | "page";
  /** Overrides the built-in markers (family = "family", child = memberId). */
  dayMarkers?: Record<DateKey, Array<"family" | string>>;
  minDate?: DateKey;
  maxDate?: DateKey;
  className?: string;
};

const NARROW_BREAKPOINT = 600;
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The single plan calendar. Mode follows the container width (not the device):
 * < 600px → swipe strip, otherwise week row. SSR renders the week row; the mode
 * is refined before first paint on the client. Row height is the same in both.
 */
export function PlanCalendar({ value, onChange, variant, dayMarkers, minDate, maxDate, className }: PlanCalendarProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  const focusAfterMove = useRef(false);

  useIsoLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => setNarrow(el.getBoundingClientRect().width < NARROW_BREAKPOINT);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const calendar = usePlanCalendar({
    value,
    onChange,
    minDate,
    maxDate,
    onKeyboardMove: () => {
      focusAfterMove.current = true;
    },
  });

  // Visible range we need markers for: reported by the active mode.
  const [stripRange, setStripRange] = useState<{ from: DateKey; to: DateKey } | null>(null);
  const [monthView, setMonthView] = useState<DateKey | null>(null);
  const onVisibleRange = useCallback((from: DateKey, to: DateKey) => {
    setStripRange((r) => (r && r.from === from && r.to === to ? r : { from, to }));
  }, []);

  const range = useMemo(() => {
    if (narrow && stripRange) return stripRange;
    if (monthView) {
      const matrix = monthMatrix(monthView);
      return { from: matrix[0]![0]!, to: matrix[matrix.length - 1]![6]! };
    }
    return { from: calendar.days[0]!, to: calendar.days[6]! };
  }, [narrow, stripRange, monthView, calendar.days]);

  const fetched = usePlanDayCounts(range, { enabled: !dayMarkers });
  const markers = dayMarkers ?? fetched;

  // After a keyboard move, keep focus on the (possibly re-rendered) selected cell.
  useEffect(() => {
    if (!focusAfterMove.current) return;
    focusAfterMove.current = false;
    rootRef.current?.querySelector<HTMLElement>(`[data-day="${value}"]`)?.focus({ preventScroll: true });
  }, [value, narrow]);

  return (
    <div ref={rootRef} className={`${styles.root} ${className ?? ""}`} data-plan-calendar data-mode={narrow ? "strip" : "week"}>
      {narrow ? (
        <MobileStrip
          value={value}
          markers={markers}
          minDate={minDate}
          maxDate={maxDate}
          calendar={calendar}
          onVisibleRange={onVisibleRange}
        />
      ) : (
        <DesktopWeek
          value={value}
          variant={variant}
          markers={markers}
          minDate={minDate}
          maxDate={maxDate}
          calendar={calendar}
          onMonthView={setMonthView}
        />
      )}
    </div>
  );
}
