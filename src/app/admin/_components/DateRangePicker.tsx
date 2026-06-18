"use client";

import { useEffect, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isAfter,
  isBefore,
  isSameDay,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type DateRangePickerProps = {
  onApply: (from: Date, to: Date) => void;
  onClose: () => void;
};

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function mondayIndex(date: Date): number {
  return (getDay(date) + 6) % 7;
}

function CalendarMonth({
  anchor,
  rangeStart,
  rangeEnd,
  hoverDate,
  onDayClick,
  onDayHover,
  onNav,
}: {
  anchor: Date;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  hoverDate: Date | null;
  onDayClick: (d: Date) => void;
  onDayHover: (d: Date | null) => void;
  onNav: (dir: -1 | 1) => void;
}) {
  const today = startOfDay(new Date());
  const first = startOfMonth(anchor);
  const last = endOfMonth(anchor);
  const days = eachDayOfInterval({ start: first, end: last });
  const leadingEmpty = mondayIndex(first);

  const effectiveEnd = rangeEnd ?? hoverDate;

  function isInRange(d: Date): boolean {
    if (!rangeStart || !effectiveEnd) return false;
    const lo = isBefore(rangeStart, effectiveEnd) ? rangeStart : effectiveEnd;
    const hi = isBefore(rangeStart, effectiveEnd) ? effectiveEnd : rangeStart;
    return isAfter(d, lo) && isBefore(d, hi);
  }

  function isSelected(d: Date): boolean {
    if (rangeStart && isSameDay(d, rangeStart)) return true;
    if (rangeEnd && isSameDay(d, rangeEnd)) return true;
    return false;
  }

  const isFuture = (d: Date) => isAfter(startOfDay(d), today);

  return (
    <div className="min-w-[224px]">
      {/* Month header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => onNav(-1)}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-sm font-semibold text-gray-900 capitalize">
          {format(anchor, "LLLL yyyy", { locale: ru })}
        </span>
        <button
          type="button"
          onClick={() => onNav(1)}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((l) => (
          <div
            key={l}
            className="text-center text-xs text-gray-400 font-medium py-1"
          >
            {l}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {Array.from({ length: leadingEmpty }).map((_, i) => (
          <div key={`e-${i}`} />
        ))}
        {days.map((d) => {
          const future = isFuture(d);
          const selected = isSelected(d);
          const inRange = isInRange(d);

          return (
            <button
              key={d.toISOString()}
              type="button"
              disabled={future}
              onClick={() => !future && onDayClick(startOfDay(d))}
              onMouseEnter={() => !future && onDayHover(startOfDay(d))}
              onMouseLeave={() => onDayHover(null)}
              className={cn(
                "h-8 w-8 mx-auto flex items-center justify-center text-xs rounded-full transition-colors",
                future && "pointer-events-none opacity-40",
                selected && "bg-gray-900 text-white font-semibold",
                !selected && inRange && "bg-gray-100 text-gray-900 rounded-none",
                !selected && !inRange && !future && "hover:bg-gray-100 text-gray-700",
                isSameDay(d, today) && !selected && "font-semibold text-blue-600",
              )}
            >
              {format(d, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangePicker({ onApply, onClose }: DateRangePickerProps) {
  const today = startOfDay(new Date());
  const [leftAnchor, setLeftAnchor] = useState(() => addMonths(startOfMonth(today), -1));
  const [rightAnchor, setRightAnchor] = useState(() => startOfMonth(today));
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  function handleDayClick(d: Date) {
    if (!rangeStart || rangeEnd) {
      setRangeStart(d);
      setRangeEnd(null);
    } else {
      if (isSameDay(d, rangeStart)) return;
      if (isBefore(d, rangeStart)) {
        setRangeEnd(rangeStart);
        setRangeStart(d);
      } else {
        setRangeEnd(d);
      }
    }
  }

  function handleReset() {
    setRangeStart(null);
    setRangeEnd(null);
    setHoverDate(null);
  }

  function handleApply() {
    if (!rangeStart || !rangeEnd) return;
    onApply(rangeStart, rangeEnd);
  }

  const canApply = rangeStart !== null && rangeEnd !== null;

  const selectionLabel =
    rangeStart && rangeEnd
      ? `${format(rangeStart, "dd.MM.yyyy")} — ${format(rangeEnd, "dd.MM.yyyy")}`
      : rangeStart
        ? `${format(rangeStart, "dd.MM.yyyy")} — ...`
        : "Выберите даты";

  return (
    <div
      ref={containerRef}
      className="absolute right-0 top-full mt-2 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-max"
    >
      <div className="flex gap-6">
        <CalendarMonth
          anchor={leftAnchor}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          hoverDate={hoverDate}
          onDayClick={handleDayClick}
          onDayHover={setHoverDate}
          onNav={(dir) => setLeftAnchor((a) => addMonths(a, dir))}
        />
        <div className="w-px bg-gray-100 self-stretch" />
        <CalendarMonth
          anchor={rightAnchor}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          hoverDate={hoverDate}
          onDayClick={handleDayClick}
          onDayHover={setHoverDate}
          onNav={(dir) => setRightAnchor((a) => addMonths(a, dir))}
        />
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between gap-4">
        <span className="text-xs text-gray-500">{selectionLabel}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 text-xs rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Сбросить
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            className={cn(
              "px-3 py-1.5 text-xs rounded-md transition-colors",
              canApply
                ? "bg-gray-900 text-white hover:bg-gray-800"
                : "bg-gray-100 text-gray-400 cursor-not-allowed",
            )}
          >
            Применить
          </button>
        </div>
      </div>
    </div>
  );
}
