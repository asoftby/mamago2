"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import type { DashboardPeriod } from "@/server/services/business/businessWorkspace.service";

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: "today",     label: "Сегодня"  },
  { value: "yesterday", label: "Вчера"    },
  { value: "week",      label: "Неделя"   },
  { value: "month",     label: "Месяц"    },
  { value: "quarter",   label: "Квартал"  },
];

function formatShortDate(d: Date) {
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function CustomRangePicker({
  onApply,
  onClose,
}: {
  onApply: (from: Date, to: Date) => void;
  onClose: () => void;
}) {
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  function handleDayClick(date: Date | null) {
    if (!date) return;
    if (!from || (from && to)) { setFrom(date); setTo(null); }
    else { if (date < from) { setTo(from); setFrom(date); } else { setTo(date); } }
  }

  const canApply = from && to;

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-50 mt-2 w-[320px] rounded-2xl border border-stone-200 bg-white p-4 shadow-xl"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-400">
        Выберите период
      </p>
      <Calendar
        size="compact"
        disablePast={false}
        value={from}
        onChange={handleDayClick}
        rangeStart={from}
        rangeEnd={to ?? undefined}
      />
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-stone-100 pt-3">
        <p className="text-xs text-stone-400">
          {from && to
            ? `${formatShortDate(from)} — ${formatShortDate(to)}`
            : from ? `С ${formatShortDate(from)} — выберите конец` : "Выберите начало периода"}
        </p>
        <button
          type="button"
          disabled={!canApply}
          onClick={() => canApply && onApply(from!, to!)}
          className={cn(
            "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
            canApply ? "bg-stone-900 text-white hover:bg-stone-800" : "cursor-not-allowed bg-stone-100 text-stone-400",
          )}
        >
          Применить
        </button>
      </div>
    </div>
  );
}

interface DashboardPeriodSwitcherProps {
  value: DashboardPeriod;
  onChange: (p: DashboardPeriod) => void;
  onCustomRange?: (from: Date, to: Date) => void;
}

export function DashboardPeriodSwitcher({
  value,
  onChange,
  onCustomRange,
}: DashboardPeriodSwitcherProps) {
  const [customLabel, setCustomLabel] = useState<string | undefined>();
  const [activePeriod, setActivePeriod] = useState<DashboardPeriod | "custom">(value);
  const [pickerOpen, setPickerOpen] = useState(false);

  function handlePreset(p: DashboardPeriod) {
    setActivePeriod(p);
    onChange(p);
    setPickerOpen(false);
  }

  function handleCustomApply(from: Date, to: Date) {
    setActivePeriod("custom");
    setCustomLabel(`${formatShortDate(from)} — ${formatShortDate(to)}`);
    onCustomRange?.(from, to);
    setPickerOpen(false);
  }

  return (
    <div className="relative flex flex-wrap items-center gap-1 rounded-2xl border border-stone-200 bg-white p-1 shadow-sm">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => handlePreset(p.value)}
          className={cn(
            "rounded-xl px-3 py-1.5 text-sm font-medium transition-all",
            activePeriod === p.value
              ? "bg-stone-900 text-white shadow-sm"
              : "text-stone-500 hover:bg-stone-100 hover:text-stone-800",
          )}
        >
          {p.label}
        </button>
      ))}

      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-medium transition-all",
          activePeriod === "custom"
            ? "bg-stone-900 text-white shadow-sm"
            : "text-stone-500 hover:bg-stone-100 hover:text-stone-800",
        )}
      >
        {activePeriod === "custom" && customLabel ? customLabel : "Период"}
        <svg
          className={cn("h-3 w-3 transition-transform", pickerOpen && "rotate-180")}
          viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
        >
          <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {pickerOpen && (
        <CustomRangePicker
          onApply={handleCustomApply}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
