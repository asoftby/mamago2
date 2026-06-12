"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
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
}: WeekCalendarStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

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
  const monthLabel = useMemo(() => buildWeekMonthLabel(weekDays, selectedDate), [weekDays, selectedDate]);
  const yearLabel = useMemo(() => new Date(`${visibleWeekStart}T12:00:00`).getFullYear(), [visibleWeekStart]);
  const todayIso = new Date().toISOString().split("T")[0] ?? "";

  const shiftWeek = (dir: 1 | -1) => {
    const nextStart = dir === 1 ? getNextWeekStart(visibleWeekStart) : getPrevWeekStart(visibleWeekStart);
    setVisibleWeekStart(nextStart);
    if (onChangeDate) onChangeDate(preserveWeekday(selectedDate, nextStart));
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
      <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 28px", gap: 6, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => shiftWeek(-1)}
          aria-label="Предыдущая неделя"
          style={{
            width: 28, height: 28, borderRadius: 99,
            background: "transparent", border: "1px solid rgba(20,18,16,.18)",
            color: "#3A332B", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        ><ChevronLeft /></button>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Month + year label */}
          <div style={{ textAlign: "center" }}>
            <span
              style={{ fontFamily: "Menlo, monospace", fontSize: 13, fontWeight: 400, lineHeight: 1, letterSpacing: ".08em", color: "#141210" }}
            >
              {monthLabel}{" "}
              <span style={{ fontFamily: "var(--font-display)", color: "rgba(20,18,16,.45)", fontWeight: 400, letterSpacing: "-.02em" }}>{yearLabel}</span>
            </span>
          </div>

          {/* Days row */}
          <div ref={scrollRef} style={{ display: "flex", gap: 3 }}>
            {weekDays.map((iso) => {
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
                  ref={selected ? selectedRef : undefined}
                  type="button"
                  disabled={isPast && !selected}
                  onClick={() => !isPast && onChangeDate?.(iso)}
                  style={{
                    flex: "1 1 0",
                    minWidth: 0,
                    minHeight: compact ? 52 : 56,
                    padding: compact ? "6px 4px 10px" : "7px 4px 11px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    background: selected ? "#141210" : "transparent",
                    color: selected ? "#FAF7F1" : isPast ? "rgba(20,18,16,.35)" : "#141210",
                    border: selected ? "1px solid #141210" : "1px solid transparent",
                    borderRadius: 10,
                    cursor: isPast && !selected ? "default" : "pointer",
                    transition: "all .15s",
                    position: "relative",
                    opacity: isPast && !selected ? 0.45 : 1,
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
                  {hasPlannedItems ? (
                    <span
                      aria-label={plannedLabel}
                      title={plannedLabel}
                      className={cn(
                        "absolute left-1/2 bottom-0.5 z-10 -translate-x-1/2 inline-flex items-center justify-center",
                        plannedCount === 1
                          ? "h-1.5 w-1.5 rounded-full"
                          : "min-w-4 rounded-full px-1 text-[9px] font-semibold leading-4",
                        selected
                          ? "bg-white text-[#141210]"
                          : "bg-[#EF8759] text-white",
                      )}
                    >
                      {plannedCount > 1 ? plannedCount : null}
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
