"use client";

import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { PlanCalendarIcon } from "@/components/icons/PlanCalendarIcon";
import { cn } from "@/lib/utils";
import { useMyPlan } from "../hooks/useMyPlan";

interface MyPlanMobileWidgetProps {
  onOpen: () => void;
}

/** «Сб 11:30 · Киберкласс» — ближайшее событие плана. */
function formatNearestLine(input: {
  dateStr: string | null;
  startsAt: Date | string | null;
  title: string | null;
}): string | null {
  const { dateStr, startsAt, title } = input;
  if (!dateStr) return title;
  const date = parseISO(dateStr);
  const weekday = format(date, "EEEEEE", { locale: ru });
  const day = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const time = startsAt
    ? new Date(startsAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : null;
  const when = [day, time].filter(Boolean).join(" ");
  return [when, title].filter(Boolean).join(" · ");
}

/**
 * Мобильный (< lg) плавающий виджет «Мой план» — единственный элемент низа экрана
 * и главный цветовой акцент. Фон — затемнённый brand-active (#AA4220): белый текст и вторая строка (opacity .85) ≥ 4.5:1;
 * сам --brand-active (#C85F35) даёт только ~4.1:1, поэтому оттенок темнее.
 * Анимации — только реакция на добавление события (пульс + счётчик), с учётом reduced motion.
 */
export function MyPlanMobileWidget({ onOpen }: MyPlanMobileWidgetProps) {
  const {
    weekItemsCount,
    nextPlanItem,
    authLoading,
    isLoading,
    isAuthenticated,
    planSummaryLoading,
    planSummary,
  } = useMyPlan();

  const loading = authLoading || isLoading || (isAuthenticated && planSummaryLoading);
  const nearestItem = planSummary?.nearestItems[0] ?? null;

  let count = 0;
  if (!loading && isAuthenticated) {
    if (weekItemsCount > 0) count = weekItemsCount;
    else if (nextPlanItem) count = planSummary?.nearestCount || 1;
  }

  let nearestLine: string | null = null;
  if (count > 0) {
    nearestLine =
      nearestItem && planSummary?.nearestDate
        ? formatNearestLine({
            dateStr: planSummary.nearestDate,
            startsAt: nearestItem.startsAt ?? null,
            title: nearestItem.activity?.title ?? null,
          })
        : formatNearestLine({
            dateStr: nextPlanItem?.date ?? null,
            startsAt: null,
            title: nextPlanItem?.item.title ?? null,
          });
  }

  return (
    <MyPlanMobileWidgetView
      count={count}
      nearestLine={nearestLine}
      loading={loading}
      onOpen={onOpen}
    />
  );
}

interface MyPlanMobileWidgetViewProps {
  count: number;
  nearestLine: string | null;
  loading?: boolean;
  onOpen: () => void;
}

export function MyPlanMobileWidgetView({
  count,
  nearestLine,
  loading = false,
  onOpen,
}: MyPlanMobileWidgetViewProps) {
  // Пульс — только когда счётчик вырос (событие добавили), не при первой загрузке.
  const prevCountRef = useRef<number | null>(null);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (loading) return;
    const prev = prevCountRef.current;
    prevCountRef.current = count;
    if (prev === null || count <= prev) return;
    const frame = requestAnimationFrame(() => setPulse(true));
    return () => cancelAnimationFrame(frame);
  }, [count, loading]);
  useEffect(() => {
    if (!pulse) return;
    const timer = window.setTimeout(() => setPulse(false), 150);
    return () => window.clearTimeout(timer);
  }, [pulse]);

  const hasEvents = count > 0;
  const ariaLabel = hasEvents
    ? `Мой план, событий: ${count}${nearestLine ? `. Ближайшее: ${nearestLine}` : ""}`
    : "Мой план, пока нет событий";

  return (
    <div
      className="pointer-events-none fixed inset-x-3 z-40 lg:hidden"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={ariaLabel}
        data-my-plan-mobile-widget
        className={cn(
          "pointer-events-auto flex h-16 w-full items-center gap-3 rounded-[22px] px-4 text-left text-white",
          "bg-[#AA4220]",
          "touch-manipulation transition-transform duration-150 ease-out active:scale-[0.98]",
          pulse ? "scale-105 motion-reduce:scale-100" : "scale-100",
        )}
        style={{
          boxShadow:
            "0 8px 24px rgba(170, 66, 32, 0.35)",
                  }}
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
          <PlanCalendarIcon className="h-6 w-6 text-white" />
          {hasEvents && (
            <span
              key={count}
              className={cn(
                "absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1",
                "text-[11px] font-bold leading-none text-[#AA4220]",
                pulse && "motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300",
              )}
              aria-hidden
            >
              {count > 9 ? "9+" : count}
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <span className="block truncate text-[15px] font-semibold leading-none">Мой план</span>
          <span className="block truncate text-xs italic leading-tight opacity-85 font-pt-serif">
            {hasEvents && nearestLine ? nearestLine : "Нет событий — соберём за 10 секунд"}
          </span>
        </span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}
