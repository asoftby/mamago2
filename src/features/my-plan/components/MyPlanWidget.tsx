"use client";

import { useMemo } from "react";
import { CalendarDays, ChevronRight } from "lucide-react";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { useMyPlan } from "../hooks/useMyPlan";
import { cn } from "@/lib/utils";

interface MyPlanWidgetProps {
  onOpen: () => void;
}

function formatTodayPlanSubtitle(count: number): string {
  if (count === 0) return "Пока ничего не запланировано";
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} событие сегодня`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} события сегодня`;
  }
  return `${count} событий сегодня`;
}

export function MyPlanWidget({ onOpen }: MyPlanWidgetProps) {
  const { todayCount } = useMyPlan();
  const { isAuthenticated, isLoading: authLoading } = useAuthMe();

  const subtitle = useMemo(() => {
    if (authLoading) return "Загрузка…";
    if (!isAuthenticated) return "Войдите, чтобы планировать";
    return formatTodayPlanSubtitle(todayCount);
  }, [authLoading, isAuthenticated, todayCount]);

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
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/8 text-white/95 ring-1 ring-white/10 backdrop-blur-sm">
            <CalendarDays className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
          </div>

          <div className="min-w-0 flex-1 text-left">
            <h2 className="text-sm font-semibold leading-tight tracking-[-0.02em]">
              Мой план
            </h2>
            <p className="mt-0.5 text-[11px] leading-snug text-white/60">{subtitle}</p>
          </div>
        </div>

        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/6 text-white/90 ring-1 ring-white/8 transition-all group-hover:bg-white/10 group-hover:translate-x-0.5">
          <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </div>
      </button>
    </div>
  );
}
