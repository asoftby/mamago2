"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  addDays,
  dayOfMonth,
  monthName,
  startOfWeek,
  todayKey,
  weekDays as weekDaysOf,
  weekdayShort,
  yearOf,
} from "@/lib/date/dateKey";

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
  itemsByDate,
  plannedCountByDate,
  countLabelByDate,
  allowPastDates = false,
}: WeekCalendarStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  const [visibleWeekStart, setVisibleWeekStart] = useState(() =>
    startOfWeek(selectedDate),
  );

  const [prevSelectedDate, setPrevSelectedDate] = useState(selectedDate);
  if (selectedDate !== prevSelectedDate) {
    const ws = startOfWeek(selectedDate);
    const prevWs = startOfWeek(prevSelectedDate);
    if (prevWs !== ws) setVisibleWeekStart(ws);
    setPrevSelectedDate(selectedDate);
  }

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [selectedDate]);

  const weekDays = useMemo(() => weekDaysOf(visibleWeekStart), [visibleWeekStart]);
  const monthLabel = monthName(selectedDate).toUpperCase();
  const yearLabel = yearOf(visibleWeekStart);
  const todayIso = todayKey();
  const todayWeekStart = startOfWeek(todayIso);
  const canShiftToPreviousWeek = allowPastDates || visibleWeekStart > todayWeekStart;

  const selectDate = (nextDate: string) => {
    const clampedDate = !allowPastDates && nextDate < todayIso ? todayIso : nextDate;
    setVisibleWeekStart(startOfWeek(clampedDate));
    onChangeDate?.(clampedDate);
  };

  const shiftWeek = (dir: 1 | -1) => {
    if (dir === -1 && !canShiftToPreviousWeek) return;

    selectDate(addDays(selectedDate, dir * 7));
  };

  const selectToday = () => {
    selectDate(todayIso);
  };

  return (
    <div
      className={cn(className)}
      style={{
        padding: "14px 14px 12px",
        background: "#FAF7F1",
        border: "1px solid rgba(20,18,16,.10)",
        borderRadius: 18,
      }}
    >
      {/* Strip: arrows + days в одной строке */}
      <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 28px", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => shiftWeek(-1)}
          disabled={!canShiftToPreviousWeek}
          aria-label="Предыдущая неделя"
          style={{
            width: 28, height: 28, borderRadius: 99,
            background: "transparent", border: "1px solid rgba(20,18,16,.18)",
            color: "#3A332B", cursor: canShiftToPreviousWeek ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            opacity: canShiftToPreviousWeek ? 1 : 0.35,
          }}
        ><ChevronLeft /></button>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
            style={{ display: "flex", gap: 3 }}
          >
            {weekDays.map((iso) => {
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
                  ref={selected ? selectedRef : undefined}
                  type="button"
                  disabled={!allowPastDates && isPast && !selected}
                  onClick={() => (allowPastDates || !isPast) && selectDate(iso)}
                  style={{
                    flex: "1 1 0",
                    minWidth: 0,
                    minHeight: countLabelByDate ? 70 : 56,
                    padding: "7px 4px 11px",
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
                    {weekdayShort(iso)}
                  </span>
                  <span
                    style={{ fontFamily: "var(--font-display)", fontSize: 20, lineHeight: 1, letterSpacing: "-.02em" }}
                  >
                    {dayOfMonth(iso)}
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

        <button
          type="button"
          onClick={() => shiftWeek(1)}
          aria-label="Следующая неделя"
          style={{
            width: 28, height: 28, borderRadius: 99,
            background: "transparent", border: "1px solid rgba(20,18,16,.18)",
            color: "#3A332B", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        ><ChevronRight /></button>
      </div>
    </div>
  );
}