"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { PlanItemWithActivity } from "../../types/event";

const D0 = 7 * 60;
const D1 = 22 * 60;

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h! * 60 + m!;
};
const pos = (min: number) => Math.max(0, Math.min(100, ((min - D0) / (D1 - D0)) * 100));
const hhmm = (d: Date) => d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false });
const startOf = (item: PlanItemWithActivity) => (item.startsAt ? new Date(item.startsAt) : null);

function dur(mins: number): string {
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return `${h ? `${h} ч` : ""}${h && r ? " " : ""}${r ? `${r} мин` : ""}` || "0 мин";
}

/** Шкала сегодняшнего дня: «Сейчас 13:40 · дальше в 16:00». Только для событий с реальным временем. */
export function PlanDayBar({ items }: { items: PlanItemWithActivity[] }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const timed = items
    .map((item) => ({ item, at: startOf(item) }))
    .filter((x): x is { item: PlanItemWithActivity; at: Date } => x.at !== null && !Number.isNaN(x.at.getTime()))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  if (timed.length === 0) return null;

  const nowLabel = hhmm(now);
  const nowMin = toMin(nowLabel);
  const next = timed.find((x) => toMin(hhmm(x.at)) > nowMin) ?? null;

  return (
    <div className="mb-4 rounded-[18px] border border-[var(--mp-line)] bg-[var(--mp-card)] px-4 pb-3 pt-3.5" aria-label="Шкала дня">
      <div className="mb-3 flex items-baseline justify-between gap-2.5 text-[13px] text-[var(--mp-tx2)]">
        <b className="text-[15px] font-extrabold tabular-nums text-[var(--mp-tx)]">Сейчас {nowLabel}</b>
        <span>
          {next ? `дальше в ${hhmm(next.at)} · через ${dur(toMin(hhmm(next.at)) - nowMin)}` : "свободно до вечера"}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-[var(--mp-soft)]">
        <i className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#DCEFD3] to-[#9FD08A]" style={{ width: `${pos(nowMin)}%` }} />
        {timed.map(({ item, at }) => {
          const m = toMin(hhmm(at));
          const isNext = next?.item.id === item.id;
          return (
            <i
              key={item.id}
              className={`absolute top-1/2 rounded-full border-2 ${m <= nowMin ? "border-[var(--mp-tx2)] bg-[var(--mp-tx2)]" : isNext ? "border-[var(--mp-tx)] bg-white" : "border-[var(--mp-tx2)] bg-white"}`}
              style={{ left: `${pos(m)}%`, width: isNext ? 12 : 10, height: isNext ? 12 : 10, margin: isNext ? "-6px 0 0 -6px" : "-5px 0 0 -5px" }}
            />
          );
        })}
        <i
          className="absolute top-1/2 h-[18px] w-[18px] rounded-full border-[3px] border-white bg-[#5FA84A] shadow-[0_1px_4px_rgba(29,27,25,.3)]"
          style={{ left: `${pos(nowMin)}%`, margin: "-9px 0 0 -9px" }}
        />
      </div>
      <div className="relative mt-1.5 h-4">
        {["08:00", "12:00", "16:00", "20:00"].map((t) => (
          <span key={t} className="absolute -translate-x-1/2 text-[11px] font-semibold tabular-nums text-[var(--mp-tx2)]" style={{ left: `${pos(toMin(t))}%` }}>
            {t.slice(0, 2)}
          </span>
        ))}
      </div>
      {next ? (
        <div className="mt-2 flex items-center gap-[7px] border-t border-[var(--mp-line)] pt-2.5 text-sm font-bold text-[var(--mp-tx)]">
          <ArrowRight className="h-3.5 w-3.5 text-[#4E9A3A]" strokeWidth={2} aria-hidden />
          <span className="min-w-0 truncate">{next.item.title || next.item.activity?.title || "Событие"}</span>
        </div>
      ) : null}
    </div>
  );
}
