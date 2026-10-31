"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  dayOfMonth,
  diffDays,
  monthGenitive,
  monthName,
  monthShort,
  todayKey,
  weekdayShort,
  yearOf,
  type DateKey,
} from "@/lib/date/dateKey";
import { ownerColor } from "@/features/plan-calendar/lib/ownerColor";
import { usePlanDayCounts } from "@/features/plan-calendar/usePlanDayCounts";
import { cn } from "@/lib/utils";
import { PLAN_FOCUS } from "./planChipStyles";

const WINDOW_DAYS = 28;
const MAX_DOTS = 3;
const SCROLL_STEP = 264;

const ARROW =
  "absolute top-1/2 z-[2] -mt-[22px] flex h-11 w-11 items-center justify-center rounded-full border border-[var(--mp-line-strong)] bg-white shadow-[0_4px_12px_-4px_rgba(20,18,16,.2)]";

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Лента дней «Мой план» v3: месяц-заголовок, кнопка «Сегодня», горизонтальная лента плиток
 * (28 дней от сегодня; если выбран прошедший день — от него) с цветными точками людей и
 * строка «Весь месяц».
 */
export function PlanDayRibbon({
  value,
  onChange,
  onOpenMonth,
  monthEnd,
}: {
  value: DateKey;
  onChange: (date: DateKey) => void;
  onOpenMonth: () => void;
  /** Последний день выбранного месяца: «до 30 ноября». */
  monthEnd: DateKey;
}) {
  const [today, setToday] = useState<DateKey>(() => todayKey());
  useEffect(() => {
    const refresh = () => setToday(todayKey());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const from = value < today ? value : today;
  const last = addDays(today, WINDOW_DAYS - 1);
  const to = value > last ? addDays(value, 6) : last;
  const days = useMemo(() => Array.from({ length: diffDays(from, to) + 1 }, (_, i) => addDays(from, i)), [from, to]);
  const markers = usePlanDayCounts({ from, to });

  const stripRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: true, right: false });
  const updateEdge = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setEdge({ left: el.scrollLeft < 4, right: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  // Выбранная плитка всегда в поле зрения.
  useEffect(() => {
    const el = stripRef.current;
    const tile = el?.querySelector<HTMLElement>(`[data-day="${value}"]`);
    if (el && tile) {
      const min = tile.offsetLeft - 18;
      const max = tile.offsetLeft + tile.offsetWidth + 18 - el.clientWidth;
      if (el.scrollLeft > min) el.scrollTo({ left: Math.max(0, min), behavior: "smooth" });
      else if (el.scrollLeft < max) el.scrollTo({ left: max, behavior: "smooth" });
    }
    updateEdge();
  }, [value, updateEdge]);

  const go = (dir: 1 | -1) => stripRef.current?.scrollBy({ left: dir * SCROLL_STEP, behavior: "smooth" });
  const month = capitalize(monthName(value).toLowerCase());

  return (
    <div id="plan-week-calendar" className="min-w-0" data-plan-ribbon>
      <div className="mx-0.5 mb-3 mt-[18px] flex items-center justify-between">
        <span className="text-[18px] font-normal tracking-[-.01em] text-[var(--mp-tx)]" aria-live="polite">
          {month} <span className="mp-font-display font-normal text-[var(--mp-tx2)]">{yearOf(value)}</span>
        </span>
        <button
          type="button"
          disabled={value === today}
          onClick={() => onChange(today)}
          className={cn(
            "mp-font-meta h-9 rounded-full border border-[var(--mp-tx)] px-3.5 text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--mp-tx)] transition-colors",
            "enabled:hover:bg-[var(--mp-tx)] enabled:hover:text-white disabled:border-[var(--mp-line-strong)] disabled:text-[var(--mp-tx2)] disabled:opacity-60",
            PLAN_FOCUS,
          )}
        >
          Сегодня
        </button>
      </div>

      <div className="relative -mx-[18px]">
        {!edge.left ? (
          <button type="button" aria-label="Назад" onClick={() => go(-1)} className={`${ARROW} left-1.5 ${PLAN_FOCUS}`}>
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        <div
          ref={stripRef}
          role="tablist"
          aria-label="Дни"
          onScroll={updateEdge}
          className="flex snap-x gap-[9px] overflow-x-auto px-[18px] pb-1 pt-0.5 [scroll-padding-inline:18px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {days.map((day) => {
            const selected = day === value;
            const isToday = day === today;
            const owners = markers[day] ?? [];
            return (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-current={isToday ? "date" : undefined}
                data-day={day}
                onClick={() => onChange(day)}
                className={cn(
                  "flex h-[92px] w-[76px] shrink-0 snap-start flex-col items-center justify-center gap-[3px] rounded-[20px] border transition-colors",
                  selected
                    ? "border-[var(--mp-tx)] bg-[var(--mp-tx)] text-white"
                    : isToday
                      ? "border-[1.5px] border-[var(--mp-tx)] bg-[var(--mp-card)] text-[var(--mp-tx)]"
                      : "border-[var(--mp-line)] bg-[var(--mp-card)] text-[var(--mp-tx)] hover:border-[var(--mp-line-strong)]",
                  PLAN_FOCUS,
                )}
              >
                <span className={cn("mp-font-meta text-[10px] uppercase tracking-[.1em]", selected ? "text-white/65" : "text-[var(--mp-tx2)]")}>
                  {weekdayShort(day)}
                </span>
                <span className="mp-font-display text-[28px] font-normal leading-none tracking-[-.02em] [font-variant-numeric:lining-nums]">{dayOfMonth(day)}</span>
                {owners.length ? (
                  <span className="flex h-3.5 items-center gap-1" aria-hidden>
                    {owners.slice(0, MAX_DOTS).map((owner) => (
                      <i key={owner} className="h-1.5 w-1.5 rounded-full" style={{ background: selected ? "#fff" : ownerColor(owner) }} />
                    ))}
                  </span>
                ) : (
                  <span className={cn("mp-font-meta h-3.5 text-[9px] uppercase tracking-[.08em]", selected ? "text-white/65" : "text-[var(--mp-tx2)]")}>
                    {isToday ? "сегодня" : monthShort(day)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {!edge.right ? (
          <button type="button" aria-label="Вперёд" onClick={() => go(1)} className={`${ARROW} right-1.5 ${PLAN_FOCUS}`}>
            <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onOpenMonth}
        className={cn(
          "mt-3 flex min-h-[62px] w-full items-center gap-3 rounded-[20px] border-[1.5px] border-dashed border-[var(--mp-line-strong)] py-0 pl-3.5 pr-[18px] text-left transition-colors",
          "hover:border-[var(--mp-tx2)] hover:bg-[var(--mp-card)]",
          PLAN_FOCUS,
        )}
      >
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-[var(--mp-line-strong)] bg-white">
          <CalendarDays className="h-4 w-4" strokeWidth={1.8} aria-hidden />
        </span>
        <span className="flex-1 text-[15px] font-semibold text-[var(--mp-tx)]">Весь месяц</span>
        <span className="mp-font-meta text-[11px] text-[var(--mp-tx2)]">
          до {dayOfMonth(monthEnd)} {monthGenitive(monthEnd)} →
        </span>
      </button>
    </div>
  );
}
