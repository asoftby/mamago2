"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { addDays, diffDays, type DateKey } from "@/lib/date/dateKey";
import { DayCell } from "./DayCell";
import { monthYearLabel } from "./lib/labels";
import type { PlanDayMarkers } from "./usePlanDayCounts";
import type { usePlanCalendar } from "./usePlanCalendar";
import styles from "./plan-calendar.module.css";

const WINDOW_DAYS = 60;
const LOAD_DAYS = 30;
const EDGE_DAYS = 10;
const MAX_PAST_DAYS = 90;
const CENTER_INDEX = 3;
const WHEEL_THROTTLE_MS = 120;

type Props = {
  value: DateKey;
  markers: PlanDayMarkers;
  minDate?: DateKey;
  maxDate?: DateKey;
  calendar: ReturnType<typeof usePlanCalendar>;
  onVisibleRange?: (from: DateKey, to: DateKey) => void;
};

type Range = { start: DateKey; end: DateKey; token: number };

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Swipeable strip: exactly 7 days per screen, scroll-snap, windowed (±60 days) with edge loading. */
export function MobileStrip({ value, markers, minDate, maxDate, calendar, onVisibleRange }: Props) {
  const { today, select, goToday, onKeyDown } = calendar;
  const stripRef = useRef<HTMLDivElement>(null);

  // 90 days of history, but never hide the selected day.
  const lower = useMemo<DateKey>(() => {
    if (minDate) return minDate;
    const base = addDays(today, -MAX_PAST_DAYS);
    return value < base ? value : base;
  }, [minDate, today, value]);
  const upper = maxDate;

  const makeRange = useCallback(
    (center: DateKey, token: number): Range => {
      let start = addDays(center, -WINDOW_DAYS);
      let end = addDays(center, WINDOW_DAYS);
      if (start < lower) start = lower;
      if (upper && end > upper) end = upper;
      return { start, end, token };
    },
    [lower, upper],
  );

  const [range, setRange] = useState<Range>(() => makeRange(value, 0));
  // Selected day left the window (Today, URL, month grid): rebuild around it.
  if (value < range.start || value > range.end) {
    setRange(makeRange(value, range.token + 1));
  }

  const [center, setCenter] = useState<DateKey>(value);
  const rangeRef = useRef(range);
  useIsoLayoutEffect(() => {
    rangeRef.current = range;
  });
  const anchorRef = useRef<{ day: DateKey; frac: number } | null>(null);
  const prevStart = useRef(range.start);
  const prevToken = useRef(range.token);
  const mounted = useRef(false);

  const days = useMemo(() => {
    const n = diffDays(range.start, range.end) + 1;
    return Array.from({ length: n }, (_, i) => addDays(range.start, i));
  }, [range.start, range.end]);

  // Prepending days: restore the exact position of the day that was at the left edge.
  // Absolute (not a delta) because browsers may re-snap/anchor on their own after the DOM grows.
  useIsoLayoutEffect(() => {
    const el = stripRef.current;
    const anchor = anchorRef.current;
    if (el && anchor && prevToken.current === range.token && prevStart.current !== range.start) {
      el.scrollLeft = ((diffDays(range.start, anchor.day) + anchor.frac) * el.clientWidth) / 7;
    }
    anchorRef.current = null;
    prevStart.current = range.start;
  }, [range.start, range.token]);

  // Keep the selected day on the 4th position: instant on mount/rebuild, smooth otherwise.
  useIsoLayoutEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const itemW = el.clientWidth / 7;
    const left = Math.max(0, (diffDays(range.start, value) - CENTER_INDEX) * itemW);
    const instant = !mounted.current || prevToken.current !== range.token || prefersReducedMotion();
    el.scrollTo({ left, behavior: instant ? "auto" : "smooth" });
    prevToken.current = range.token;
    mounted.current = true;
    setCenter(value);
    // range.start is read for the index only; edge loading must not re-center.
  }, [value, range.token]);

  useEffect(() => {
    onVisibleRange?.(range.start, range.end);
  }, [onVisibleRange, range.start, range.end]);

  // Header month follows the day in the middle of the strip; edges load more days.
  const frame = useRef(0);
  const onScroll = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const el = stripRef.current;
      if (!el) return;
      const itemW = el.clientWidth / 7;
      if (itemW <= 0) return;
      const index = Math.round(el.scrollLeft / itemW);
      const key = addDays(rangeRef.current.start, index + CENTER_INDEX);
      setCenter((c) => (c === key ? c : key));
      const nearStart = el.scrollLeft < EDGE_DAYS * itemW;
      const nearEnd = el.scrollWidth - el.scrollLeft - el.clientWidth < EDGE_DAYS * itemW;
      if (!nearStart && !nearEnd) return;
      if (nearStart) {
        anchorRef.current = {
          day: addDays(rangeRef.current.start, index),
          frac: el.scrollLeft / itemW - index,
        };
      }
      setRange((r) => {
        let next = r;
        if (nearStart && r.start > lower) {
          const start = addDays(r.start, -LOAD_DAYS);
          next = { ...next, start: start < lower ? lower : start };
        }
        if (nearEnd && (!upper || r.end < upper)) {
          const end = addDays(r.end, LOAD_DAYS);
          next = { ...next, end: upper && end > upper ? upper : end };
        }
        return next;
      });
    });
  }, [lower, upper]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Mouse wheel (narrow container on desktop) steps one day at a time.
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    let last = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      const now = performance.now();
      if (now - last < WHEEL_THROTTLE_MS) return;
      last = now;
      el.scrollBy({ left: Math.sign(e.deltaY) * (el.clientWidth / 7), behavior: "smooth" });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const left = addDays(center, -CENTER_INDEX);
  const todayVisible = today >= left && today <= addDays(left, 6);

  return (
    <>
      <div className={styles.header}>
        <span className={styles.monthLabel} aria-live="polite">{monthYearLabel(center)}</span>
        <span className={styles.rule} />
        <button
          type="button"
          className={styles.todayPill}
          onClick={goToday}
          disabled={value === today && todayVisible}
        >
          Сегодня
        </button>
      </div>
      <div
        ref={stripRef}
        role="tablist"
        aria-label="Дни"
        className={styles.strip}
        // Prepending days is compensated manually; browser scroll anchoring would double it.
        style={{ overflowAnchor: "none" }}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
      >
        {days.map((day) => (
          <div key={day} className={styles.stripItem}>
            <DayCell
              dateKey={day}
              today={today}
              selected={day === value}
              owners={markers[day] ?? []}
              variant="mobile"
              tabIndex={day === value ? 0 : -1}
              onSelect={select}
            />
          </div>
        ))}
      </div>
    </>
  );
}
