"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatisticsRangeCalendar({ min, max, from, to, onApply, onCancel }: {
  min: string; max: string; from: string; to: string;
  onApply: (from: string, to: string) => void; onCancel: () => void;
}) {
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const [choosingEnd, setChoosingEnd] = useState(false);
  const [month, setMonth] = useState(() => {
    const last = new Date(`${to.slice(0, 7)}-01T12:00:00`);
    const previous = new Date(last.getFullYear(), last.getMonth() - 1, 1, 12);
    return previous < new Date(`${min.slice(0, 7)}-01T12:00:00`) ? last : previous;
  });
  const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  function select(key: string) {
    if (!choosingEnd) { setStart(key); setEnd(""); setChoosingEnd(true); }
    else { setStart(key < start ? key : start); setEnd(key < start ? start : key); setChoosingEnd(false); }
  }
  function move(delta: number) { setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1, 12)); }
  return (
    <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-3 sm:p-5" aria-label="Выбор периода">
      <div className="mb-4 flex items-center justify-between gap-2">
        <button type="button" aria-label="Предыдущий месяц" disabled={monthKey(month) <= min.slice(0, 7)} onClick={() => move(-1)} className="rounded-full p-2 hover:bg-stone-100 disabled:opacity-30"><ChevronLeft className="size-5" /></button>
        <p aria-live="polite" className="text-center text-sm font-medium">{choosingEnd ? "Выберите конец периода" : "Выберите начало периода"}</p>
        <button type="button" aria-label="Следующий месяц" disabled={monthKey(month) >= max.slice(0, 7)} onClick={() => move(1)} className="rounded-full p-2 hover:bg-stone-100 disabled:opacity-30"><ChevronRight className="size-5" /></button>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {[0, 1].map((offset) => {
          const date = new Date(month.getFullYear(), month.getMonth() + offset, 1, 12);
          const blanks = (date.getDay() + 6) % 7;
          const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
          return <div key={offset} className="min-w-0">
            <h4 className="mb-3 text-center text-sm font-semibold capitalize">{date.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</h4>
            <div className="grid grid-cols-7 text-center text-xs text-stone-400">{["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(day => <span key={day} className="py-2">{day}</span>)}</div>
            <div className="grid grid-cols-7 gap-y-1">
              {Array.from({ length: blanks }, (_, index) => <span key={`blank-${index}`} />)}
              {Array.from({ length: days }, (_, index) => {
                const key = `${monthKey(date)}-${String(index + 1).padStart(2, "0")}`;
                const edge = key === start || key === end;
                return <button key={key} type="button" aria-label={key} aria-pressed={edge || Boolean(end && key > start && key < end)}
                  disabled={key < min || key > max} onClick={() => select(key)}
                  className={cn("h-10 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-stone-900 disabled:text-stone-200",
                    edge ? "rounded-full bg-stone-900 text-white" : end && key > start && key < end ? "bg-orange-50 text-orange-900" : "rounded-full hover:bg-stone-100")}>{index + 1}</button>;
              })}
            </div>
          </div>;
        })}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
        <p aria-live="polite" className="text-xs text-stone-500">{start}{end ? ` — ${end}` : " — …"}</p>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm hover:bg-stone-100">Отмена</button>
          <button type="button" disabled={!end || start < min || end > max} onClick={() => onApply(start, end)} className="rounded-full bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-30">Применить</button>
        </div>
      </div>
    </div>
  );
}
