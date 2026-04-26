"use client";

import { useMemo } from "react";
import { CalendarDays, ChevronRight } from "lucide-react";
import { useMyPlan } from "../hooks/useMyPlan";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

interface MyPlanWidgetProps {
  onOpen: () => void;
}

// ─── Pluralization ────────────────────────────────────────────────────────────

function pluralEvents(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} событие`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} события`;
  return `${count} событий`;
}

function formatNextDate(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isTomorrow(d)) return "завтра";
  return format(d, "d MMMM", { locale: ru });
}

// ─── State machine ────────────────────────────────────────────────────────────

type WidgetState =
  | { kind: "loading" }
  | { kind: "unauthenticated" }
  | { kind: "empty" }
  | { kind: "today"; count: number }
  | { kind: "week"; count: number }
  | { kind: "next"; dateStr: string; title: string | null };

function resolveWidgetState(input: {
  authLoading: boolean;
  isAuthenticated: boolean;
  todayCount: number;
  weekItemsCount: number;
  nextPlanItem: { date: string; item: { title: string | null } } | null;
}): WidgetState {
  const { authLoading, isAuthenticated, todayCount, weekItemsCount, nextPlanItem } = input;

  if (authLoading) return { kind: "loading" };
  if (!isAuthenticated) return { kind: "unauthenticated" };
  if (todayCount > 0) return { kind: "today", count: todayCount };
  if (weekItemsCount > 0) return { kind: "week", count: weekItemsCount };
  if (nextPlanItem) return { kind: "next", dateStr: nextPlanItem.date, title: nextPlanItem.item.title };
  return { kind: "empty" };
}

function stateToText(state: WidgetState): { subtitle: string; badge: number | null } {
  switch (state.kind) {
    case "loading":
      return { subtitle: "Загрузка…", badge: null };
    case "unauthenticated":
      return { subtitle: "Войдите, чтобы планировать", badge: null };
    case "empty":
      return { subtitle: "Пока ничего не запланировано", badge: null };
    case "today":
      return { subtitle: `Сегодня: ${pluralEvents(state.count)}`, badge: state.count };
    case "week":
      return { subtitle: `На неделе: ${pluralEvents(state.count)}`, badge: state.count };
    case "next":
      return { subtitle: `Ближайшее: ${formatNextDate(state.dateStr)}`, badge: null };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MyPlanWidget({ onOpen }: MyPlanWidgetProps) {
  const { todayCount, weekItemsCount, nextPlanItem, authLoading, isLoading } = useMyPlan();

  // isAuthenticated: если не loading и todayCount/weekItemsCount доступны — значит авторизован
  // Используем isLoading из store вместо отдельного useAuthMe
  const isAuthenticated = !isLoading && !authLoading;

  const widgetState = useMemo(
    () =>
      resolveWidgetState({
        authLoading: authLoading || isLoading,
        isAuthenticated,
        todayCount,
        weekItemsCount,
        nextPlanItem,
      }),
    [authLoading, isLoading, isAuthenticated, todayCount, weekItemsCount, nextPlanItem],
  );

  const { subtitle, badge } = stateToText(widgetState);
  const hasItems = widgetState.kind === "today" || widgetState.kind === "week" || widgetState.kind === "next";

  return (
    <div className="fixed bottom-4 right-4 z-50 hidden w-[min(100vw-2rem,280px)] max-w-[min(100vw-2rem,280px)] lg:block animate-in fade-in slide-in-from-bottom-4">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "group w-full inline-flex items-center justify-between gap-3 rounded-full",
          "border border-white/10 bg-[linear-gradient(180deg,_#2f2f33_0%,_#1a1a1d_100%)] px-4 py-3.5 text-white",
          "shadow-[0_16px_30px_rgba(0,0,0,0.24),inset_0_2px_0_rgba(255,255,255,0.08)] transition-all duration-200",
          "hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(0,0,0,0.3),inset_0_2px_0_rgba(255,255,255,0.12)]",
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Icon + badge */}
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/8 text-white/95 ring-1 ring-white/10 backdrop-blur-sm">
            <CalendarDays
              className={cn("h-[18px] w-[18px]", hasItems && "text-[#EF8759]")}
              strokeWidth={1.8}
              aria-hidden
            />
            {badge !== null && badge > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#EF8759] px-1 text-[9px] font-bold leading-none text-white shadow-sm">
                {badge > 9 ? "9+" : badge}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1 text-left">
            <h2 className="text-sm font-semibold leading-tight tracking-[-0.02em]">
              Мой план
            </h2>
            <p
              className={cn(
                "mt-0.5 text-[11px] leading-snug truncate",
                hasItems ? "text-[#EF8759]/80" : "text-white/60",
              )}
            >
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/6 text-white/90 ring-1 ring-white/8 transition-all group-hover:bg-white/10 group-hover:translate-x-0.5">
          <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </div>
      </button>
    </div>
  );
}
