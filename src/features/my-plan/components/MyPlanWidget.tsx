"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PlanCalendarIcon } from "@/components/icons/PlanCalendarIcon";
import { useMyPlan } from "../hooks/useMyPlan";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

interface MyPlanWidgetProps {
  onOpen: () => void;
}

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

type WidgetState =
  | { kind: "loading" }
  | { kind: "unauthenticated" }
  | { kind: "empty" }
  | { kind: "single"; dateStr: string; startsAt: Date | string | null }
  | { kind: "week"; count: number }
  | { kind: "next"; dateStr: string; title: string | null; count: number };

function resolveWidgetState(input: {
  authLoading: boolean;
  isAuthenticated: boolean;
  todayCount: number;
  weekItemsCount: number;
  nextPlanItem: { date: string; item: { title: string | null } } | null;
  nearestDate?: string | null;
  nearestCount?: number;
  nearestStartsAt?: Date | string | null;
}): WidgetState {
  const { authLoading, isAuthenticated, todayCount, weekItemsCount, nextPlanItem } = input;
  if (authLoading) return { kind: "loading" };
  if (!isAuthenticated) return { kind: "unauthenticated" };
  if (input.nearestCount === 1 && input.nearestDate) {
    return { kind: "single", dateStr: input.nearestDate, startsAt: input.nearestStartsAt ?? null };
  }
  if (weekItemsCount > 0) return { kind: "week", count: weekItemsCount };
  if (nextPlanItem) return {
    kind: "next",
    dateStr: nextPlanItem.date,
    title: nextPlanItem.item.title,
    count: input.nearestCount ?? 1,
  };
  return { kind: "empty" };
}

function stateToText(state: WidgetState): { label: string; value: string; badge: number | null } {
  switch (state.kind) {
    case "loading": return { label: "Загрузка…", value: "", badge: null };
    case "unauthenticated": return { label: "Подберём активности", value: "под вас", badge: null };
    case "empty": return { label: "", value: "", badge: null };
    case "single": {
      const date = parseISO(state.dateStr);
      const day = isToday(date) ? "сегодня" : isTomorrow(date) ? "завтра" : format(date, "d MMMM", { locale: ru });
      const time = state.startsAt
        ? new Date(state.startsAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
        : null;
      return { label: "Ближайшее:", value: `${day}${time ? ` в ${time}` : ""}`, badge: 1 };
    }
    case "week": return { label: "На неделе:", value: pluralEvents(state.count), badge: state.count };
    case "next": return { label: "Ближайшее:", value: formatNextDate(state.dateStr), badge: state.count };
  }
}

const ArrowIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6"/>
  </svg>
);

export function MyPlanWidget({ onOpen }: MyPlanWidgetProps) {
  const {
    todayCount,
    weekItemsCount,
    nextPlanItem,
    authLoading,
    isLoading,
    isAuthenticated,
    planSummaryLoading,
    planSummary,
  } = useMyPlan();

  const widgetState = useMemo(
    () =>
      resolveWidgetState({
        authLoading: authLoading || isLoading || (isAuthenticated && planSummaryLoading),
        isAuthenticated,
        todayCount,
        weekItemsCount,
        nextPlanItem,
        nearestDate: planSummary?.nearestDate,
        nearestCount: planSummary?.nearestCount,
        nearestStartsAt: planSummary?.nearestItems[0]?.startsAt ?? null,
      }),
    [
      authLoading,
      isLoading,
      isAuthenticated,
      nextPlanItem,
      planSummary,
      planSummaryLoading,
      todayCount,
      weekItemsCount,
    ],
  );

  const { label, value, badge } = stateToText(widgetState);
  const hasItems = widgetState.kind === "single" || widgetState.kind === "week" || widgetState.kind === "next";

  const prevBadgeRef = useRef(badge);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (prevBadgeRef.current !== badge && badge !== null && badge > 0) {
      const frame = requestAnimationFrame(() => setPulse(true));
      const t = setTimeout(() => setPulse(false), 250);
      prevBadgeRef.current = badge;
      return () => { cancelAnimationFrame(frame); clearTimeout(t); };
    }
    prevBadgeRef.current = badge;
  }, [badge]);

  return (
    <div className="fixed bottom-4 right-4 z-50 hidden lg:block animate-in fade-in slide-in-from-bottom-4">
      <button
        type="button"
        onClick={onOpen}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 14px 14px 12px",
          borderRadius: 999,
          background: "#F6F2EA",
          border: "1px solid #EBEBEB",
          boxShadow: "0 16px 30px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.7)",
          cursor: "pointer",
          transition: "all .22s",
          minWidth: 220,
        }}
        onMouseEnter={(e) => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.transform = "translateY(-2px)";
          b.style.boxShadow = "0 20px 36px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.7)";
        }}
        onMouseLeave={(e) => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.transform = "none";
          b.style.boxShadow = "0 16px 30px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.7)";
        }}
      >
        {/* Icon + badge */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <span
            style={{
              width: 36, height: 36, borderRadius: 99,
              background: "#FFFFFF",
              border: hasItems ? "1px solid rgba(239,135,89,0.40)" : "1px solid #E5E7EB",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all .2s",
              transform: pulse ? "scale(1.12)" : "scale(1)",
              boxShadow: "0 1px 2px rgba(20,18,16,0.05)",
            }}
          >
            <PlanCalendarIcon
              className={cn("h-5 w-5", hasItems ? "text-[#C24E22]" : "text-gray-400")}
            />
          </span>
          {badge !== null && badge > 0 && (
            <span style={{
              position: "absolute", top: -2, right: -2,
              minWidth: 16, height: 16,
              borderRadius: 99,
              background: "#E86A3A",
              color: "#fff",
              fontSize: 9, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 4px",
              transform: pulse ? "scale(1.2)" : "scale(1)",
              transition: "transform .2s",
            }}>
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </div>

        {/* Text */}
        <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
          <div
            style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 400, lineHeight: 1, color: "#141210" }}
          >
            Мой план{widgetState.kind === "unauthenticated" && (
              <em style={{ fontFamily: "var(--font-editorial)", fontStyle: "italic", color: "#C24E22" }}> за 10 секунд</em>
            )}
          </div>
          <div className="mt-0.5 truncate text-left text-xs leading-tight font-sans">
            {widgetState.kind === "empty" ? (
              <span>
                <span className="text-neutral-900">Нет событий —</span>{" "}
                <em className="font-pt-serif italic text-primary">
                  соберём за 10 секунд
                </em>
              </span>
            ) : widgetState.kind === "unauthenticated" ? (
              <span className="text-neutral-400">Подберём активности под вас</span>
            ) : (
              <span className="text-neutral-700">
                {label}
                {value ? ` ${value}` : ""}
              </span>
            )}
          </div>
        </div>

        {/* Arrow */}
        <span style={{
          width: 28, height: 28, borderRadius: 99,
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "rgba(20,18,16,.55)",
          flexShrink: 0,
          boxShadow: "0 1px 2px rgba(20,18,16,0.05)",
        }}>
          <ArrowIcon />
        </span>
      </button>
    </div>
  );
}
