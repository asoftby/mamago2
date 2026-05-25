"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

interface PlanWidgetData {
  todayCount: number;
  nextEventTitle: string | null;
}

export function PlanWidget() {
  const [data, setData] = useState<PlanWidgetData | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    fetch(`/api/save/plan/day?date=${today}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (!json) return;
        const items = json.items ?? [];
        const sorted = [...items].sort((a: { startsAt: string | null }, b: { startsAt: string | null }) =>
          (a.startsAt ?? "").localeCompare(b.startsAt ?? ""),
        );
        setData({
          todayCount: items.length,
          nextEventTitle: sorted[0]?.title ?? sorted[0]?.activity?.title ?? null,
        });
      })
      .catch(() => {});
  }, []);

  const subtitle = data === null
    ? "Загрузка..."
    : data.todayCount === 0
      ? "Нет событий"
      : data.nextEventTitle ?? `${data.todayCount} событий`;

  return (
    <Link
      href="/me"
      className="hidden lg:flex items-center gap-3 h-11 px-4 rounded-full bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shrink-0"
    >
      <CalendarDays className="h-4 w-4 text-white/60 shrink-0" />
      <div className="flex flex-col min-w-0">
        <span style={{ fontFamily: "Georgia, serif", fontSize: 14, fontWeight: 400, lineHeight: "1.2" }}>Мой план</span>
        <span className="text-[11px] text-white/50 leading-tight truncate max-w-[140px]">
          {subtitle}
        </span>
      </div>
    </Link>
  );
}
