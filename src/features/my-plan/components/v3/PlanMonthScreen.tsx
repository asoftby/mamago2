"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, Plus } from "lucide-react";
import {
  addDays,
  addMonths,
  dayOfMonth,
  diffDays,
  monthGenitive,
  monthName,
  monthOf,
  monthShort,
  pluralRu,
  startOfMonth,
  weekdayIndex,
  weekdayShort,
  yearOf,
  type DateKey,
} from "@/lib/date/dateKey";
import type { FamilyCalendarItemDto } from "@/server/services/manualPlanEntry.service";
import { cn } from "@/lib/utils";
import { PLAN_FOCUS } from "./planChipStyles";
import { PlanScreenHeader } from "./PlanScreenHeader";

const MAX_MONTHS_AHEAD = 12;

const CAPS = "mp-font-meta text-[10px] font-medium uppercase tracking-[.1em] text-[var(--mp-tx2)]";

function dela(n: number): string {
  return `${n} ${pluralRu(n, ["дело", "дела", "дел"])}`;
}

function lastDayOf(key: DateKey): DateKey {
  return addDays(startOfMonth(addMonths(key, 1)), -1);
}

function itemTitle(item: FamilyCalendarItemDto): string {
  return item.title?.trim() || item.activity?.title || "Событие";
}

function itemTime(item: FamilyCalendarItemDto): string | null {
  const iso = item.effectiveStartsAt ?? item.startsAt;
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false });
}

type Block =
  | { kind: "week"; key: string; label: string }
  | { kind: "day"; key: string; day: DateKey; items: FamilyCalendarItemDto[] }
  | { kind: "free"; key: string; from: DateKey; to: DateKey };

function dayLabel(day: DateKey, today: DateKey): string {
  if (day === today) return "Сегодня";
  if (day === addDays(today, 1)) return "Завтра";
  return `${dayOfMonth(day)} ${monthGenitive(day)}`;
}

function freeLabel(from: DateKey, to: DateKey): string {
  return from === to
    ? `${dayOfMonth(from)} ${monthGenitive(from)}`
    : `${dayOfMonth(from)}–${dayOfMonth(to)} ${monthGenitive(to)}`;
}

/**
 * «Весь месяц» внутри модалки: недели → дни-раскрывашки с делами и «свободно» диапазоны.
 * Данные месяца грузим тем же `/api/plan/calendar`, что и страница плана (до 42 дней за запрос).
 */
export function PlanMonthScreen({
  today,
  selected,
  onBack,
  onClose,
  onOpenDay,
  onAddOnDay,
}: {
  today: DateKey;
  selected: DateKey;
  onBack: () => void;
  onClose?: () => void;
  /** Дело/день выбран: показать его в первом экране. */
  onOpenDay: (day: DateKey) => void;
  onAddOnDay: (day: DateKey) => void;
}) {
  const startOffset = (yearOf(selected) - yearOf(today)) * 12 + monthOf(selected) - monthOf(today);
  const [offset, setOffset] = useState(() => Math.min(Math.max(startOffset, 0), MAX_MONTHS_AHEAD));
  const [open, setOpen] = useState<DateKey | null>(selected);
  const [cache, setCache] = useState<Record<string, FamilyCalendarItemDto[]>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const monthStart = startOfMonth(addMonths(today, offset));
  const monthEnd = lastDayOf(monthStart);
  const from = offset === 0 ? today : monthStart;
  const monthKey = monthStart.slice(0, 7);
  const items = cache[monthKey];

  useEffect(() => {
    if (cache[monthKey]) return;
    let cancelled = false;
    void fetch(`/api/plan/calendar?from=${monthStart}&to=${monthEnd}`, { credentials: "include" })
      .then(async (res) => {
        const body = res.ok ? ((await res.json()) as { items?: FamilyCalendarItemDto[] }) : null;
        if (cancelled) return;
        if (!body?.items) {
          setFailed(monthKey);
          return;
        }
        setFailed(null);
        setCache((current) => ({ ...current, [monthKey]: body.items! }));
      })
      .catch(() => {
        if (!cancelled) setFailed(monthKey);
      });
    return () => {
      cancelled = true;
    };
  }, [cache, monthKey, monthStart, monthEnd]);

  const { blocks, total } = useMemo(() => {
    const byDay = new Map<DateKey, FamilyCalendarItemDto[]>();
    for (const item of items ?? []) byDay.set(item.date, [...(byDay.get(item.date) ?? []), item]);
    const list: Block[] = [];
    let freeRun: Extract<Block, { kind: "free" }> | null = null;
    let weekKey = "";
    let count = 0;
    for (let day = from; diffDays(day, monthEnd) >= 0; day = addDays(day, 1)) {
      const ws = addDays(day, -weekdayIndex(day));
      if (ws !== weekKey) {
        weekKey = ws;
        freeRun = null;
        const we = addDays(day, 6 - weekdayIndex(day));
        const cut = diffDays(monthEnd, we) > 0 ? monthEnd : we;
        list.push({ kind: "week", key: `w${ws}`, label: `${dayOfMonth(day)} ${monthShort(day)} – ${dayOfMonth(cut)} ${monthShort(cut)}` });
      }
      const dayItems = byDay.get(day) ?? [];
      if (dayItems.length) {
        freeRun = null;
        count += dayItems.length;
        list.push({ kind: "day", key: day, day, items: dayItems });
      } else if (freeRun) {
        freeRun.to = day;
      } else {
        freeRun = { kind: "free", key: `f${day}`, from: day, to: day };
        list.push(freeRun);
      }
    }
    return { blocks: list, total: count };
  }, [items, from, monthEnd]);

  const prevMonth = addMonths(monthStart, -1);
  const nextMonth = addMonths(monthStart, 1);
  const nextCount = cache[nextMonth.slice(0, 7)]?.length;
  const goMonth = (next: number) => {
    setOffset(next);
    setOpen(null);
    bodyRef.current?.scrollTo({ top: 0 });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--mp-bg)]">
      <PlanScreenHeader
        kicker="Весь месяц"
        title={`${monthName(monthStart).charAt(0)}${monthName(monthStart).slice(1).toLowerCase()}${items === undefined ? "" : ` · ${total ? dela(total) : "дел пока нет"}`}`}
        onBack={onBack}
        onClose={onClose}
      />

      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-0 md:px-8">
        {items === undefined && failed !== monthKey ? (
          <div className="mt-4 space-y-2.5" aria-busy>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-[20px] border border-[var(--mp-line)] bg-[var(--mp-card)]" />
            ))}
          </div>
        ) : failed === monthKey ? (
          <div className="mt-4 rounded-[22px] border border-[var(--mp-line)] bg-[var(--mp-card)] p-[18px] text-[15px] leading-6 text-[var(--mp-tx2)]">
            Не получилось загрузить месяц.{" "}
            <button type="button" onClick={() => { setFailed(null); setCache((c) => ({ ...c })); }} className="font-bold text-[var(--mp-ac-dark)]">
              Попробовать снова
            </button>
          </div>
        ) : (
          blocks.map((block) => {
            if (block.kind === "week") {
              return (
                <div key={block.key} className={cn(CAPS, "mx-0.5 mb-2.5 mt-[22px] flex items-center gap-3")}>
                  <span>{block.label}</span>
                  <i aria-hidden className="h-px flex-1 bg-[var(--mp-line)]" />
                </div>
              );
            }
            if (block.kind === "free") {
              return (
                <button
                  key={block.key}
                  type="button"
                  onClick={() => onAddOnDay(block.from)}
                  className={cn(
                    "mb-2 flex min-h-[50px] w-full items-center gap-2.5 rounded-2xl border-[1.5px] border-dashed border-[var(--mp-line-strong)] pl-4 pr-2.5 text-left text-[14.5px] text-[var(--mp-tx2)]",
                    "transition-colors hover:border-[var(--mp-tx2)] hover:text-[var(--mp-tx)]",
                    PLAN_FOCUS,
                  )}
                >
                  {block.from === today ? (
                    <span className="mp-font-meta inline-flex h-6 items-center rounded-md bg-[var(--mp-tx)] px-2 text-[11px] uppercase tracking-[.12em] text-white">сегодня</span>
                  ) : null}
                  <span className="flex-1">{freeLabel(block.from, block.to)} · свободно</span>
                  <span className="flex h-8 w-8 items-center justify-center opacity-60">
                    <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </span>
                </button>
              );
            }
            const isOpen = open === block.day;
            return (
              <div
                key={block.key}
                className={cn(
                  "mb-2 overflow-hidden rounded-[20px] border",
                  isOpen ? "border-[var(--mp-tx)] bg-white" : "border-[var(--mp-line)] bg-[var(--mp-card)]",
                )}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : block.day)}
                  className={cn(
                    "flex min-h-[68px] w-full items-center gap-3.5 py-2.5 pl-4 pr-3.5 text-left",
                    isOpen && "bg-[var(--mp-tx)] text-white",
                    PLAN_FOCUS,
                  )}
                >
                  <span className="flex w-[34px] shrink-0 flex-col items-center">
                    <span className={cn(CAPS, isOpen && "text-white/65")}>{weekdayShort(block.day)}</span>
                    <span className="mp-font-display text-[28px] leading-none">{dayOfMonth(block.day)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-[16px] font-semibold">{dayLabel(block.day, today)}</b>
                    <span className={cn(CAPS, isOpen && "text-white/65")}>{dela(block.items.length)}</span>
                  </span>
                  <ChevronDown className={cn("h-[18px] w-[18px] shrink-0 transition-transform", isOpen && "rotate-180")} strokeWidth={2} aria-hidden />
                </button>
                {isOpen ? (
                  <div className="px-3.5 pb-2.5 pt-3.5">
                    {block.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onOpenDay(block.day)}
                        className={cn(
                          "mb-2 flex w-full items-center gap-2.5 rounded-2xl border border-[var(--mp-line)] bg-[var(--mp-card)] py-2.5 pl-2.5 pr-3 text-left transition-colors hover:border-[var(--mp-tx2)]",
                          PLAN_FOCUS,
                        )}
                      >
                        <span className="mp-font-meta w-11 shrink-0 text-center text-[12.5px] font-semibold tabular-nums text-[var(--mp-tx)]">{itemTime(item) ?? "день"}</span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 block text-[15px] font-semibold leading-[1.3] text-[var(--mp-tx)] [overflow-wrap:anywhere]">{itemTitle(item)}</span>
                          <span className="mp-font-meta mt-0.5 block text-[12px] text-[var(--mp-tx2)]">{item.childName ?? "все"}</span>
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => onAddOnDay(block.day)}
                      className={cn("flex h-11 w-full items-center justify-center gap-2 rounded-[14px] text-[14.5px] font-semibold text-[var(--mp-tx2)] hover:bg-[var(--mp-card)] hover:text-[var(--mp-tx)]", PLAN_FOCUS)}
                    >
                      <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
                      Добавить на этот день
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}

        <div className="mt-[18px] flex flex-col gap-2.5">
          {offset > 0 ? (
            <button
              type="button"
              onClick={() => goMonth(offset - 1)}
              className={cn(
                "flex min-h-[72px] w-full items-center gap-3 rounded-[22px] border border-[var(--mp-line)] bg-[var(--mp-card)] py-3 pl-[18px] pr-5 text-left text-[var(--mp-tx)] transition-colors hover:border-[var(--mp-tx)]",
                PLAN_FOCUS,
              )}
            >
              <ArrowLeft className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden />
              <span className="flex-1">
                <span className={cn(CAPS, "block")}>назад</span>
                <b className="mt-0.5 block text-[19px] font-semibold">
                  {monthName(prevMonth)[0]}
                  {monthName(prevMonth).slice(1).toLowerCase()} <span className="mp-font-display font-normal text-[var(--mp-tx2)]">{yearOf(prevMonth)}</span>
                </b>
              </span>
            </button>
          ) : null}
          {offset < MAX_MONTHS_AHEAD ? (
            <button
              type="button"
              onClick={() => goMonth(offset + 1)}
              className={cn("flex min-h-[72px] w-full items-center gap-3 rounded-[22px] bg-[var(--mp-tx)] py-3 pl-5 pr-[18px] text-left text-white", PLAN_FOCUS)}
            >
              <span className="flex-1">
                <span className={cn(CAPS, "block text-white/60")}>дальше</span>
                <b className="mt-0.5 block text-[19px] font-semibold">
                  {monthName(nextMonth)[0]}
                  {monthName(nextMonth).slice(1).toLowerCase()} <span className="mp-font-display font-normal text-white/60">{yearOf(nextMonth)}</span>
                </b>
              </span>
              <span className="mp-font-meta text-[12px] text-white/70">{nextCount === undefined ? "" : nextCount ? dela(nextCount) : "пока пусто"}</span>
              <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
            </button>
          ) : (
            <p className="mx-1 mt-2 text-center text-[14px] leading-[1.5] text-[var(--mp-tx2)]">
              План можно составить на год вперёд. Прошедшие дела — в «Где мы были».
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
