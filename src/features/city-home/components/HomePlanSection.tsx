"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

interface PlanData {
  todayCount: number;
  nextEventTitle: string | null;
}

export function HomePlanSection() {
  const [data, setData] = useState<PlanData | null>(null);

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
      className="group block bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl p-6 text-white hover:shadow-lg transition-all duration-300"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 bg-white/10 rounded-full group-hover:bg-white/20 transition-colors">
          <CalendarDays className="h-6 w-6 text-white/80" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold mb-1">Мой план</h2>
          <p className="text-sm text-white/70">
            {subtitle}
          </p>
        </div>
      </div>
    </Link>
  );
}
