"use client";

import React, { useEffect, useMemo, useRef } from "react";
import {
  getNextWeekStart,
  getPrevWeekStart,
  getWeekDays,
  getWeekStart,
  preserveWeekday,
} from "@/features/my-plan/lib/weekCalendar";
import { getLocalDateKey } from "@/lib/date/localDateKey";
import type { SerializedPlanItem } from "./PlanPageClient";

const DAYS_RU_SHORT: Record<number, string> = { 1:"Пн", 2:"Вт", 3:"Ср", 4:"Чт", 5:"Пт", 6:"Сб", 0:"Вс" };
const MONTHS_RU = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

type Props = {
  selectedDate: string;
  onSelect: (date: string) => void;
  itemsByDate: Record<string, SerializedPlanItem[]>;
  onToday: () => void;
  loading?: boolean;
};

export function WeekCalendar({ selectedDate, onSelect, itemsByDate, onToday, loading = false }: Props) {
  const todayISO = getLocalDateKey();
  const [weekStart, setWeekStart] = React.useState(() => getWeekStart(selectedDate));
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setWeekStart(getWeekStart(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [selectedDate]);

  const weekDates = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const shiftWeek = (dir: 1 | -1) => {
    const next = dir === 1 ? getNextWeekStart(weekStart) : getPrevWeekStart(weekStart);
    setWeekStart(next);
    onSelect(preserveWeekday(selectedDate, next));
  };

  // Determine current month label from the first date in the strip
  const firstDate = new Date(`${weekDates[0]}T00:00:00.000Z`);
  const lastDate = new Date(`${weekDates[weekDates.length - 1]}T00:00:00.000Z`);
  const monthLabel = firstDate.getUTCMonth() === lastDate.getUTCMonth()
    ? `${MONTHS_RU[firstDate.getUTCMonth()].charAt(0).toUpperCase() + MONTHS_RU[firstDate.getUTCMonth()].slice(1)} ${firstDate.getUTCFullYear()}`
    : `${MONTHS_RU[firstDate.getUTCMonth()].charAt(0).toUpperCase() + MONTHS_RU[firstDate.getUTCMonth()].slice(1)} – ${MONTHS_RU[lastDate.getUTCMonth()]} ${lastDate.getUTCFullYear()}`;

  return (
    <div>
      {/* Month header row */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, marginBottom: 14 }}>
        <span
          className="font-mono uppercase"
          style={{ fontSize: 11, letterSpacing: ".14em", color: "rgba(20,18,16,.55)", whiteSpace: "nowrap" }}
        >
          {monthLabel}
        </span>
        <div style={{ flex: 1, height: 1, background: "rgba(20,18,16,.10)" }} />
        <button
          type="button"
          onClick={() => shiftWeek(-1)}
          className="font-mono uppercase"
          style={{ fontSize: 11, letterSpacing: ".1em", color: "#3A332B", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          ← пред
        </button>
        <button
          type="button"
          onClick={() => shiftWeek(1)}
          className="font-mono uppercase"
          style={{ fontSize: 11, letterSpacing: ".1em", color: "#3A332B", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          след →
        </button>
        <button
          type="button"
          onClick={onToday}
          className="min-h-11 rounded-full border px-3 text-xs font-semibold"
          style={{ borderColor: "rgba(20,18,16,.18)", color: "#3A332B" }}
        >
          Сегодня
        </button>
        {loading ? <span role="status" className="text-xs text-neutral-500">Загрузка…</span> : null}
      </div>

      {/* Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "38px 1fr 38px", gap: 10, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => shiftWeek(-1)}
          aria-label="Предыдущая неделя"
          style={{
            width: 38, height: 38, borderRadius: 99,
            background: "#FAF7F1", border: "1px solid rgba(20,18,16,.10)",
            color: "#141210", cursor: "pointer", fontSize: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          ‹
        </button>

        <div
          ref={scrollRef}
          style={{
            display: "flex", gap: 8,
            scrollbarWidth: "none",
            padding: "2px 2px",
          }}
        >
          {weekDates.map((dateStr) => {
            const date = new Date(`${dateStr}T00:00:00.000Z`);
            const dow = DAYS_RU_SHORT[date.getUTCDay()];
            const dayNum = date.getUTCDate();
            const isToday = dateStr === todayISO;
            const isSelected = dateStr === selectedDate;
            const itemsCount = itemsByDate[dateStr]?.length ?? 0;
            const isPast = dateStr < todayISO;

            return (
              <button
                key={dateStr}
                ref={isSelected ? selectedRef : undefined}
                type="button"
                onClick={() => onSelect(dateStr)}
                style={{
                  flex: "1 1 0",
                  minWidth: 0,
                  padding: "14px 6px 12px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  width: "auto",
                  background: isSelected ? "#141210" : "#FAF7F1",
                  color: isSelected ? "#FAF7F1" : isPast ? "rgba(20,18,16,.38)" : "#141210",
                  border: `1px solid ${isSelected ? "#141210" : "rgba(20,18,16,.10)"}`,
                  borderRadius: 14,
                  cursor: "pointer",
                  transition: "all .15s",
                  position: "relative",
                  opacity: isPast && !isSelected ? 0.72 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#141210";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(20,18,16,.10)";
                  }
                }}
              >
                <span
                  className="font-mono uppercase"
                  style={{
                    fontSize: 10,
                    letterSpacing: ".1em",
                    color: isSelected ? "rgba(250,247,241,.55)" : "rgba(20,18,16,.55)",
                  }}
                >
                  {dow}
                </span>
                <span
                  className="font-display"
                  style={{ fontSize: 28, lineHeight: 1, letterSpacing: "-.02em" }}
                >
                  {dayNum}
                </span>
                {/* Dots for events */}
                <span style={{ display: "flex", gap: 3, height: 5, alignItems: "center", marginTop: 1 }}>
                  {Array.from({ length: Math.min(itemsCount, 4) }).map((_, di) => (
                    <span
                      key={di}
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 99,
                        background: "#E86A3A",
                      }}
                    />
                  ))}
                </span>
                {/* Today indicator */}
                {isToday && !isSelected && (
                  <span
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 7,
                      height: 7,
                      borderRadius: 99,
                      background: "#E86A3A",
                      boxShadow: "0 0 0 2px #FAF7F1",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => shiftWeek(1)}
          aria-label="Следующая неделя"
          style={{
            width: 38, height: 38, borderRadius: 99,
            background: "#FAF7F1", border: "1px solid rgba(20,18,16,.10)",
            color: "#141210", cursor: "pointer", fontSize: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          ›
        </button>
      </div>
    </div>
  );
}
