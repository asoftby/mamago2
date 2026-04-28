"use client";

import { useId, useMemo, useState } from "react";
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
  const activePillLayoutId = useId();

  // Sync visibleWeekStart when selectedDate changes externally
  const nextStart = getWeekStart(selectedDate);
  if (nextStart !== visibleWeekStart) {
    setVisibleWeekStart(nextStart);
  }

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
        compact && "rounded-none border-0 bg-transparent py-1 shadow-none",
        className,
      )}
    >
      {showArrows ? (
        <>
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            className="absolute left-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Предыдущая неделя"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Следующая неделя"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      ) : null}

      <div className="mb-2 text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={monthLabel}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="inline-block text-[11px] font-medium uppercase leading-none text-neutral-400"
          >
            {monthLabel}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className={cn("overflow-hidden", compact ? "px-8" : "px-8 sm:gap-2")}>
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={visibleWeekStart}
            custom={direction}
            initial={{ x: direction > 0 ? 42 : -42, opacity: 0.96 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction > 0 ? -42 : 42, opacity: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            drag="x"
            dragElastic={0.1}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, info) => {
              const threshold = 44;
              if (info.offset.x <= -threshold) shiftWeek(1);
              if (info.offset.x >= threshold) shiftWeek(-1);
            }}
            className="flex items-stretch justify-between gap-1"
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
                    "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-2.5 text-neutral-700",
                    isPast && !selected && "cursor-not-allowed opacity-40",
                  )}
                >
                  {selected ? (
                    <motion.span
                      layoutId={`week-active-pill-${activePillLayoutId}`}
                      className="absolute inset-0 rounded-full bg-primary shadow-sm"
                      transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.36 }}
                    />
                  ) : null}
                  <span
                    className={cn(
                      "relative z-10 text-[11px] font-medium uppercase leading-none transition-colors duration-200",
                      selected
                        ? "text-primary-foreground/90"
                        : isPast
                          ? "text-neutral-400/80"
                          : "text-neutral-400",
                    )}
                  >
                    {WEEKDAY_SHORT_RU[d.getDay()]}
                  </span>
                  <span
                    className={cn(
                      "relative z-10 text-[15px] font-semibold tabular-nums leading-none transition-colors duration-200",
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
        </AnimatePresence>
      </div>
    </div>
  );
}
