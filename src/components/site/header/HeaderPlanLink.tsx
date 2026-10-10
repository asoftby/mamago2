"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { getLocalDateKey } from "@/lib/date/localDateKey";
import { MY_PLAN_FULL_PAGE_HREF } from "@/features/my-plan/lib/upcomingPlanItems";

/** Пункт шапки «Мой план» (десктоп): светло-коралловая плашка + счётчик событий на сегодня. */
export function HeaderPlanLink() {
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/save/plan/day?date=${getLocalDateKey()}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        setTodayCount(Array.isArray(json.items) ? json.items.length : 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link
      href={MY_PLAN_FULL_PAGE_HREF}
      className="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-brand-soft px-3 text-[14px] font-medium text-brand-active no-underline outline-none transition-colors hover:bg-brand-soft-hover focus-visible:ring-2 focus-visible:ring-brand-active"
      aria-label={todayCount > 0 ? `Мой план, сегодня событий: ${todayCount}` : "Мой план"}
    >
      <CalendarDays className="h-4 w-4" aria-hidden />
      <span>Мой план</span>
      {todayCount > 0 ? (
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-active px-1 text-[11px] font-medium leading-none text-white">
          {todayCount > 9 ? "9+" : todayCount}
        </span>
      ) : null}
    </Link>
  );
}
