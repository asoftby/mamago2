"use client";

import { useMemo } from "react";
import { CalendarDays, ChevronRight } from "lucide-react";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { useMyPlan } from "../hooks/useMyPlan";

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
    <div className="fixed bottom-4 right-4 z-50 hidden w-[min(100vw-2rem,250px)] max-w-[min(100vw-2rem,250px)] lg:block animate-in fade-in slide-in-from-bottom-4">
      <button
        type="button"
        onClick={onOpen}
        className="group block w-full overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.08),_transparent_28%),linear-gradient(135deg,_#2b2b2f_0%,_#17171a_58%,_#111214_100%)] px-2.5 py-2.5 text-left text-white shadow-[0_9px_20px_rgba(19,19,22,0.16)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(19,19,22,0.2)] sm:px-3 sm:py-3"
      >
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-white/8 text-white/95 ring-1 ring-white/10 backdrop-blur-sm">
            <CalendarDays className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-[11px] font-semibold leading-tight tracking-[-0.02em] sm:text-xs">
              Мой план
            </h2>
            <p className="mt-0.5 text-[9px] leading-snug text-white/60 sm:text-[10px]">{subtitle}</p>
          </div>

          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/6 text-white/90 ring-1 ring-white/8 transition-colors group-hover:bg-white/10">
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          </div>
        </div>
      </button>
    </div>
  );
}
