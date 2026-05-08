"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

type WeekCalendarStripProps = {
  selectedDate: string;
  onChangeDate?: (iso: string) => void;
  className?: string;
  compact?: boolean;
  /** Показывать стрелки переключения недели. По умолчанию true. */
  showArrows?: boolean;
};

export function WeekCalendarStrip({
  selectedDate,
  onChangeDate,
  className,
  compact = false,
  showArrows = true,
}: WeekCalendarStripProps) {
  const [visibleWeekStart, setVisibleWeekStart] = useState(() =>
    getWeekStart(selectedDate),
  );
  const [direction, setDirection] = useState<1 | -1>(1);
  const prevSyncedWeekStartRef = useRef<string | null>(null);
  /** После mount включаем slide-in только при смене недели — без рывка на холодной загрузке. */
  const [motionEnabled, setMotionEnabled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setMotionEnabled(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const [prevSelectedDate, setPrevSelectedDate] = useState(selectedDate);

  if (selectedDate !== prevSelectedDate) {
    const ws = getWeekStart(selectedDate);
    const prevWs = getWeekStart(prevSelectedDate);
    if (prevWs !== ws) {
      setDirection(ws.localeCompare(prevWs) >= 0 ? 1 : -1);
      setVisibleWeekStart(ws);
    }
    setPrevSelectedDate(selectedDate);
  }

  useEffect(() => {
    const ws = getWeekStart(selectedDate);
    prevSyncedWeekStartRef.current = ws;
  }, [selectedDate]);

  const weekDays = useMemo(() => getWeekDays(visibleWeekStart), [visibleWeekStart]);
  const monthLabel = useMemo(() => buildWeekMonthLabel(weekDays, selectedDate), [weekDays, selectedDate]);
  const todayIso = new Date().toISOString().split("T")[0] ?? "";

  const shiftWeek = (dir: 1 | -1) => {
    const nextStart = dir === 1 ? getNextWeekStart(visibleWeekStart) : getPrevWeekStart(visibleWeekStart);
    setDirection(dir);
    setVisibleWeekStart(nextStart);
    if (onChangeDate) onChangeDate(preserveWeekday(selectedDate, nextStart));
  };

  return (
    <div
      className={cn(
        "relative rounded-3xl border border-neutral-200/80 bg-white p-3 shadow-sm",
        compact &&
          "rounded-none border-0 bg-transparent px-0 py-1 shadow-none",
        className,
      )}
    >
      {showArrows ? (
        <>
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            className="absolute left-0 top-1/2 z-20 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Предыдущая неделя"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            className="absolute right-0 top-1/2 z-20 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Следующая неделя"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      ) : null}

      <div className="relative mb-2 min-h-[14px] text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={monthLabel}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-x-0 top-0 text-[11px] font-medium uppercase leading-none text-neutral-400"
          >
            {monthLabel}
          </motion.p>
        </AnimatePresence>
      </div>

      <div
        className={cn(
          "relative z-0 isolate overflow-hidden",
          compact ? "min-h-11 px-8" : "min-h-11 px-8 sm:gap-2",
        )}
      >
        <motion.div
          key={visibleWeekStart}
          initial={
            motionEnabled
              ? { x: direction > 0 ? 28 : -28, opacity: 0.88 }
              : false
          }
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          drag="x"
          dragElastic={0.1}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={(_, info) => {
            const threshold = 44;
            if (info.offset.x <= -threshold) shiftWeek(1);
            if (info.offset.x >= threshold) shiftWeek(-1);
          }}
          className={cn(
            "absolute top-0 flex items-center justify-between gap-1",
            compact
              ? "left-1/2 w-[85%] max-w-full -translate-x-1/2"
              : "inset-x-0",
          )}
        >
          {weekDays.map((iso) => {
            const d = new Date(`${iso}T12:00:00`);
            const selected = iso === selectedDate;
            const isPast = iso < todayIso;
            return (
              <button
                key={iso}
                type="button"
                aria-pressed={selected}
                aria-label={d.toLocaleDateString("ru-RU", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
                disabled={isPast && !selected}
                onClick={() => !isPast && onChangeDate?.(iso)}
                className={cn(
                  "relative flex h-11 min-h-11 min-w-0 flex-1 shrink-0 flex-col items-center justify-center gap-0.5 rounded-none text-neutral-700",
                  "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isPast && !selected && "cursor-not-allowed opacity-40",
                )}
              >
                {selected ? (
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute left-1/2 top-1/2 z-0 size-11 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary",
                    )}
                  />
                ) : null}
                <span
                  className={cn(
                    "relative z-10 text-[10px] font-medium uppercase leading-none transition-colors duration-300 ease-out",
                    selected
                      ? "text-primary-foreground"
                      : isPast
                        ? "text-neutral-400/80"
                        : "text-neutral-400",
                  )}
                >
                  {WEEKDAY_SHORT_RU[d.getDay()]}
                </span>
                <span
                  className={cn(
                    "relative z-10 text-[14px] font-semibold tabular-nums leading-none transition-colors duration-300 ease-out",
                    selected
                      ? "text-primary-foreground"
                      : isPast
                        ? "text-neutral-500"
                        : "text-neutral-900",
                  )}
                >
                  {d.getDate()}
                </span>
              </button>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
