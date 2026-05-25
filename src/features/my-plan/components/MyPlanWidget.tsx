"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMyPlan } from "../hooks/useMyPlan";
import { cn } from "@/lib/utils";
import { format, isTomorrow, parseISO } from "date-fns";
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

function stateToText(state: WidgetState): { label: string; value: string; badge: number | null } {
  switch (state.kind) {
    case "loading": return { label: "Загрузка…", value: "", badge: null };
    case "unauthenticated": return { label: "Подберём активности", value: "под вас", badge: null };
    case "empty": return { label: "Пока ничего", value: "не запланировано", badge: null };
    case "today": return { label: "Сегодня:", value: pluralEvents(state.count), badge: state.count };
    case "week": return { label: "На неделе:", value: pluralEvents(state.count), badge: state.count };
    case "next": return { label: "Ближайшее:", value: formatNextDate(state.dateStr), badge: null };
  }
}

const CalIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="3"/>
    <path d="M16 2v4M8 2v4M3 10h18"/>
  </svg>
);
const ArrowIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6"/>
  </svg>
);

export function MyPlanWidget({ onOpen }: MyPlanWidgetProps) {
  const { todayCount, weekItemsCount, nextPlanItem, authLoading, isLoading, isAuthenticated } = useMyPlan();

  const widgetState = useMemo(
    () => resolveWidgetState({ authLoading: authLoading || isLoading, isAuthenticated, todayCount, weekItemsCount, nextPlanItem }),
    [authLoading, isLoading, isAuthenticated, todayCount, weekItemsCount, nextPlanItem],
  );

  const { label, value, badge } = stateToText(widgetState);
  const hasItems = widgetState.kind === "today" || widgetState.kind === "week" || widgetState.kind === "next";

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
          padding: "10px 14px 10px 12px",
          borderRadius: 999,
          background: "rgba(210, 206, 199, 0.72)",
          backdropFilter: "blur(32px) saturate(1.4)",
          WebkitBackdropFilter: "blur(32px) saturate(1.4)",
          border: "1px solid rgba(255,255,255,0.55)",
          boxShadow: [
            "0 8px 32px -8px rgba(20,18,16,.18)",
            "0 2px 8px -2px rgba(20,18,16,.10)",
            "inset 0 1px 0 rgba(255,255,255,.70)",
            "inset 0 -1px 0 rgba(20,18,16,.06)",
            "inset 1px 0 0 rgba(255,255,255,.45)",
            "inset -1px 0 0 rgba(255,255,255,.25)",
          ].join(", "),
          cursor: "pointer",
          transition: "all .22s",
          minWidth: 220,
        }}
        onMouseEnter={(e) => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.transform = "translateY(-2px)";
          b.style.boxShadow = [
            "0 16px 40px -10px rgba(20,18,16,.24)",
            "0 4px 12px -4px rgba(20,18,16,.14)",
            "inset 0 1px 0 rgba(255,255,255,.75)",
            "inset 0 -1px 0 rgba(20,18,16,.06)",
            "inset 1px 0 0 rgba(255,255,255,.50)",
            "inset -1px 0 0 rgba(255,255,255,.30)",
          ].join(", ");
        }}
        onMouseLeave={(e) => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.transform = "none";
          b.style.boxShadow = [
            "0 8px 32px -8px rgba(20,18,16,.18)",
            "0 2px 8px -2px rgba(20,18,16,.10)",
            "inset 0 1px 0 rgba(255,255,255,.70)",
            "inset 0 -1px 0 rgba(20,18,16,.06)",
            "inset 1px 0 0 rgba(255,255,255,.45)",
            "inset -1px 0 0 rgba(255,255,255,.25)",
          ].join(", ");
        }}
      >
        {/* Icon + badge */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <span
            style={{
              width: 36, height: 36, borderRadius: 99,
              background: hasItems ? "rgba(232,106,58,0.18)" : "rgba(210,206,199,0.50)",
              color: hasItems ? "#C24E22" : "rgba(20,18,16,.55)",
              border: `1px solid ${hasItems ? "rgba(232,106,58,.22)" : "rgba(255,255,255,.70)"}`,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all .2s",
              transform: pulse ? "scale(1.12)" : "scale(1)",
            }}
          >
            <CalIcon />
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
            style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 400, lineHeight: 1, color: "#141210" }}
          >
            Мой план{widgetState.kind === "unauthenticated" && (
              <em style={{ fontStyle: "italic", color: "#C24E22" }}> за 10 секунд</em>
            )}
          </div>
          <div
            className="font-sans"
            style={{
              marginTop: 3,
              fontSize: 11,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: "#141210" }}>{label}</span>
            {value && <span style={{ color: "#141210" }}> {value}</span>}
          </div>
        </div>

        {/* Arrow */}
        <span style={{
          width: 28, height: 28, borderRadius: 99,
          background: "rgba(210,206,199,0.50)",
          border: "1px solid rgba(255,255,255,.50)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "rgba(20,18,16,.55)",
          flexShrink: 0,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}>
          <ArrowIcon />
        </span>
      </button>
    </div>
  );
}
