"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { addDaysLocal, getLocalDateKey } from "@/lib/date/localDateKey";
import {
  buildWeekMonthLabel,
  getNextWeekStart,
  getPrevWeekStart,
  getWeekDays,
  getWeekStart,
  preserveWeekday,
} from "../lib/weekCalendar";

const WEEKDAY_SHORT_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] as const;

const ChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6"/>
  </svg>
);
const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
);

type WeekCalendarStripProps = {
  selectedDate: string;
  onChangeDate?: (iso: string) => void;
  className?: string;
  compact?: boolean;
  showArrows?: boolean;
  itemsByDate?: Record<string, unknown[]>;
  plannedCountByDate?: Record<string, number>;
  countLabelByDate?: Record<string, string>;
  allowPastDates?: boolean;
};

function pluralizePlanEvents(count: number): string {
  const abs = Math.abs(count);
  const mod100 = abs % 100;
  const mod10 = abs % 10;

  if (mod100 >= 11 && mod100 <= 14) return "событий";
  if (mod10 === 1) return "событие";
  if (mod10 >= 2 && mod10 <= 4) return "события";
  return "событий";
}

export function WeekCalendarStrip({
  selectedDate,
  onChangeDate,
  className,
  compact = false,
  showArrows = true,
  itemsByDate,
  plannedCountByDate,
  countLabelByDate,
  allowPastDates = false,
}: WeekCalendarStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const compactScrollTimerRef = useRef<number | null>(null);

  const [visibleWeekStart, setVisibleWeekStart] = useState(() =>
    getWeekStart(selectedDate),
  );

  const [prevSelectedDate, setPrevSelectedDate] = useState(selectedDate);
  if (selectedDate !== prevSelectedDate) {
    const ws = getWeekStart(selectedDate);
    const prevWs = getWeekStart(prevSelectedDate);
    if (prevWs !== ws) setVisibleWeekStart(ws);
    setPrevSelectedDate(selectedDate);
  }

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [selectedDate]);

  const weekDays = useMemo(() => getWeekDays(visibleWeekStart), [visibleWeekStart]);
  const compactDays = useMemo(() => {
    let start = visibleWeekStart;
    const today = getLocalDateKey();
    if (!allowPastDates && start < today) start = today;
    return Array.from({ length: 18 }, (_, index) => addDaysLocal(start, index));
  }, [allowPastDates, visibleWeekStart]);
  const renderedDays = compact ? compactDays : weekDays;
  const monthLabel = useMemo(() => buildWeekMonthLabel(weekDays, selectedDate), [weekDays, selectedDate]);
  const yearLabel = useMemo(() => new Date(`${visibleWeekStart}T12:00:00`).getFullYear(), [visibleWeekStart]);
  const todayIso = getLocalDateKey();
  const todayWeekStart = getWeekStart(todayIso);
  const canShiftToPreviousWeek = allowPastDates || visibleWeekStart > todayWeekStart;

  const selectDate = (nextDate: string) => {
    const clampedDate = !allowPastDates && nextDate < todayIso ? todayIso : nextDate;
    setVisibleWeekStart(getWeekStart(clampedDate));
    onChangeDate?.(clampedDate);
  };

  const shiftWeek = (dir: 1 | -1) => {
    if (dir === -1 && !canShiftToPreviousWeek) return;

    const nextStart = dir === 1
      ? getNextWeekStart(visibleWeekStart)
      : getPrevWeekStart(visibleWeekStart);
    const preservedDate = preserveWeekday(selectedDate, nextStart);
    selectDate(preservedDate);
  };

  const selectToday = () => {
    selectDate(todayIso);
  };

  const handleCompactScroll = () => {
    if (!compact) return;
    if (compactScrollTimerRef.current != null) {
      window.clearTimeout(compactScrollTimerRef.current);
    }
    compactScrollTimerRef.current = window.setTimeout(() => {
      const container = scrollRef.current;
      if (!container) return;
      const buttons = Array.from(
        container.querySelectorAll<HTMLButtonElement>("[data-plan-date]"),
      );
      if (buttons.length === 0) return;
      const center = container.scrollLeft + container.clientWidth / 2;
      let nearest = buttons[0]!;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const button of buttons) {
        const buttonCenter = button.offsetLeft + button.offsetWidth / 2;
        const distance = Math.abs(buttonCenter - center);
        if (distance < nearestDistance) {
          nearest = button;
          nearestDistance = distance;
        }
      }
      const nextDate = nearest.dataset.planDate;
      if (nextDate && nextDate !== selectedDate) selectDate(nextDate);
    }, 90);
  };

  return (
    <div
      className={cn(className)}
      style={{
        padding: compact ? "18px 14px 16px" : "14px 14px 12px",
        background: "#FAF7F1",
        border: "1px solid rgba(20,18,16,.10)",
        borderRadius: 18,
      }}
    >
      {/* Strip: arrows + days в одной строке */}
      <div style={{ display: "grid", gridTemplateColumns: showArrows ? "36px 1fr 36px" : "1fr", gap: 10, alignItems: "center" }}>
        {showArrows ? <button
          type="button"
          onClick={() => shiftWeek(-1)}
          disabled={!canShiftToPreviousWeek}
          aria-label="Предыдущая неделя"
          style={{
            width: 36, height: 36, borderRadius: 99,
            background: "#fff", border: "1px solid rgba(20,18,16,.16)",
            color: "#3A332B", cursor: canShiftToPreviousWeek ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            opacity: canShiftToPreviousWeek ? 1 : 0.35,
          }}
        ><ChevronLeft /></button> : null}

        <div style={{ display: "flex", flexDirection: "column", gap: compact ? 10 : 6 }}>
          {/* Month + year + quick jump to today */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span aria-hidden="true" />
            <span
              style={{
                fontFamily: "Menlo, monospace",
                fontSize: 13,
                fontWeight: 400,
                lineHeight: 1,
                letterSpacing: ".08em",
                color: "#141210",
                textAlign: "center",
              }}
            >
              {monthLabel}{" "}
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  color: "rgba(20,18,16,.45)",
                  fontWeight: 400,
                  letterSpacing: "-.02em",
                }}
              >
                {yearLabel}
              </span>
            </span>
            <button
              type="button"
              onClick={selectToday}
              disabled={selectedDate === todayIso}
              className="justify-self-end"
              style={{
                minHeight: 28,
                padding: "0 10px",
                borderRadius: 999,
                border: "1px solid rgba(20,18,16,.10)",
                background: selectedDate === todayIso ? "rgba(255,255,255,.45)" : "#fff",
                color: selectedDate === todayIso ? "rgba(20,18,16,.38)" : "#3A332B",
                fontSize: 11,
                fontWeight: 500,
                cursor: selectedDate === todayIso ? "default" : "pointer",
              }}
            >
              Сегодня
            </button>
          </div>

          {/* Days row */}
          <div
            ref={scrollRef}
            onScroll={compact ? handleCompactScroll : undefined}
            onTouchStart={(event) => {
              if (compact) return;
              const touch = event.touches[0];
              if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY };
            }}
            onTouchEnd={(event) => {
              if (compact) return;
              const start = touchStartRef.current;
              const touch = event.changedTouches[0];
              touchStartRef.current = null;
              if (!start || !touch) return;
              const dx = touch.clientX - start.x;
              const dy = touch.clientY - start.y;
              if (Math.abs(dx) < 36 || Math.abs(dx) <= Math.abs(dy)) return;
              shiftWeek(dx < 0 ? 1 : -1);
            }}
            className={compact ? "no-scrollbar" : undefined}
            style={{
              display: "flex",
              gap: compact ? 8 : 3,
              overflowX: compact ? "auto" : "visible",
              scrollSnapType: compact ? "x mandatory" : undefined,
              WebkitOverflowScrolling: compact ? "touch" : undefined,
              scrollbarWidth: compact ? "none" : undefined,
              touchAction: compact ? "pan-x pan-y" : "pan-y",
              paddingInline: compact ? 2 : 0,
            }}
          >
            {renderedDays.map((iso) => {
              const d = new Date(`${iso}T12:00:00`);
              const selected = iso === selectedDate;
              const isToday = iso === todayIso;
              const isPast = iso < todayIso;
              const plannedCount =
                plannedCountByDate?.[iso] ?? itemsByDate?.[iso]?.length ?? 0;
              const hasPlannedItems = plannedCount > 0;
              const plannedLabel = `${plannedCount} ${pluralizePlanEvents(plannedCount)} в плане`;

              return (
                <button
                  key={iso}
                  data-plan-date={iso}
                  ref={selected ? selectedRef : undefined}
                  type="button"
                  disabled={!allowPastDates && isPast && !selected}
                  onClick={() => (allowPastDates || !isPast) && selectDate(iso)}
                  style={{
                    flex: compact ? "0 0 54px" : "1 1 0",
                    minWidth: compact ? 54 : 0,
                    scrollSnapAlign: compact ? "center" : undefined,
                    minHeight: countLabelByDate ? 70 : compact ? 62 : 56,
                    padding: compact ? "8px 4px 12px" : "7px 4px 11px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    background: selected ? "#141210" : "transparent",
                    color: selected ? "#FAF7F1" : isPast ? "rgba(20,18,16,.35)" : "#141210",
                    border: selected ? "1px solid #141210" : "1px solid transparent",
                    borderRadius: 10,
                    cursor: !allowPastDates && isPast && !selected ? "default" : "pointer",
                    transition: "all .15s",
                    position: "relative",
                    opacity: !allowPastDates && isPast && !selected ? 0.45 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!selected && !isPast) (e.currentTarget as HTMLButtonElement).style.background = "rgba(20,18,16,.04)";
                  }}
                  onMouseLeave={(e) => {
                    if (!selected) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  <span
                    className="font-mono uppercase"
                    style={{
                      fontSize: 9,
                      letterSpacing: ".08em",
                      color: selected ? "rgba(250,247,241,.55)" : "rgba(20,18,16,.55)",
                    }}
                  >
                    {WEEKDAY_SHORT_RU[d.getDay()]}
                  </span>
                  <span
                    style={{ fontFamily: "var(--font-display)", fontSize: 20, lineHeight: 1, letterSpacing: "-.02em" }}
                  >
                    {d.getDate()}
                  </span>
                  {countLabelByDate ? (
                    <span style={{ fontSize: 9, lineHeight: 1.1, whiteSpace: "nowrap", color: selected ? "rgba(250,247,241,.72)" : "rgba(20,18,16,.58)" }}>
                      {countLabelByDate[iso] ?? "0 историй"}
                    </span>
                  ) : null}
                  {hasPlannedItems ? (
                    <span
                      aria-label={plannedLabel}
                      title={plannedLabel}
                      className="absolute left-1/2 bottom-0.5 z-10 -translate-x-1/2 inline-flex items-center gap-[3px]"
                    >
                      {Array.from({ length: Math.min(plannedCount, 3) }).map((_, i) => (
                        <span
                          key={i}
                          className={cn(
                            "h-1 w-1 rounded-full",
                            selected ? "bg-white" : "bg-[#EF8759]",
                          )}
                        />
                      ))}
                    </span>
                  ) : null}
                  {/* Today dot */}
                  {isToday && !selected && (
                    <span style={{
                      position: "absolute", top: 4, right: 4,
                      width: 5, height: 5, borderRadius: 99,
                      background: "#E86A3A",
                      boxShadow: "0 0 0 2px #FAF7F1",
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {showArrows ? <button
          type="button"
          onClick={() => shiftWeek(1)}
          aria-label="Следующая неделя"
          style={{
            width: 36, height: 36, borderRadius: 99,
            background: "#fff", border: "1px solid rgba(20,18,16,.16)",
            color: "#3A332B", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        ><ChevronRight /></button> : null}
      </div>
    </div>
  );
}