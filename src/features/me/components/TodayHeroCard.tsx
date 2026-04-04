import Link from "next/link";
import { CalendarDays } from "lucide-react";
import type { PlanItemWithActivity } from "@/server/services/plan.service";

interface TodayHeroCardProps {
  todayItems: PlanItemWithActivity[];
  todayDate: string;
}

export function TodayHeroCard({ todayItems, todayDate }: TodayHeroCardProps) {
  if (todayItems.length === 0) return null;

  const preview = todayItems.slice(0, 2);

  return (
    <div className="rounded-2xl bg-white border border-neutral-100 shadow-sm px-5 py-4">
      <div className="space-y-2.5">
        {preview.map((item) => {
          const title = item.activity?.title ?? item.title ?? "Событие";
          const time = item.startsAt
            ? new Date(item.startsAt).toLocaleTimeString("ru-RU", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : null;

          return (
            <div key={item.id} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#EF8759]/10 flex items-center justify-center shrink-0">
                <CalendarDays className="h-4 w-4 text-[#EF8759]" />
              </div>
              <div className="min-w-0">
                {time && <span className="text-xs text-neutral-400 mr-1.5">{time}</span>}
                <span className="text-sm text-neutral-800 font-medium line-clamp-1">{title}</span>
              </div>
            </div>
          );
        })}
        {todayItems.length > 2 && (
          <p className="text-xs text-neutral-400 pl-11">+{todayItems.length - 2} ещё</p>
        )}
      </div>

      <Link
        href={`/me/plan?date=${todayDate}`}
        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#EF8759] hover:text-[#e8784a] transition-colors"
      >
        Открыть план →
      </Link>
    </div>
  );
}
