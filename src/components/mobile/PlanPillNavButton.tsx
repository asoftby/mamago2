"use client";

import { useId } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export type PlanPillNavButtonProps = {
  href: string;
  isActive: boolean;
  /** Planning-related badge (recommendations, confirmations) — 0 hides */
  badgeCount?: number;
  /**
   * false → подпись «Нет событий» под заголовком.
   * TODO: подставить из стора/апи, когда появятся данные о плане.
   */
  hasPlannedEvents?: boolean;
  className?: string;
};

/**
 * Primary product anchor: «Мой план» — wider pill, strongest visual weight in the bar.
 * Иконка календаря без круга, контент слева с отступом.
 */
export function PlanPillNavButton({
  href,
  isActive,
  badgeCount = 0,
  hasPlannedEvents = false,
  className,
}: PlanPillNavButtonProps) {
  const emptyHintId = useId();
  const showBadge = badgeCount > 0;
  const showEmptyHint = !hasPlannedEvents;

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      aria-describedby={showEmptyHint ? emptyHintId : undefined}
      className={cn(
        "relative flex min-h-[52px] min-w-0 flex-1 items-center rounded-full py-2 pl-4 pr-3",
        "border transition-all duration-200 ease-out will-change-transform",
        "active:scale-[0.985] active:transition-transform",
        isActive
          ? "border-[#EF8759]/40 bg-gradient-to-b from-white to-[#FFF8F5] shadow-[inset_0_1px_0_rgba(255,255,255,1),0_6px_20px_rgba(239,135,89,0.22)]"
          : "border-white/75 bg-white/65 shadow-sm shadow-black/[0.05]",
        className,
      )}
    >
      <div className="flex w-full min-w-0 items-start gap-2.5">
        <CalendarDays
          className={cn(
            "h-5 w-5 shrink-0 stroke-[1.75]",
            isActive ? "text-neutral-500" : "text-neutral-400",
          )}
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
          <span
            className={cn(
              "text-[15px] font-semibold leading-tight tracking-tight",
              isActive ? "text-gray-900" : "text-gray-800",
            )}
          >
            Мой план
          </span>
          {showEmptyHint && (
            <span
              id={emptyHintId}
              className="text-left text-[11px] leading-snug text-neutral-500"
            >
              Нет событий
            </span>
          )}
        </div>
        {showBadge && (
          <span
            className={cn(
              "ml-auto shrink-0 self-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none",
              isActive
                ? "bg-[#EF8759]/15 text-[#c45a2e]"
                : "bg-black/[0.06] text-gray-600",
            )}
          >
            {badgeCount > 99 ? "99+" : `+${badgeCount}`}
          </span>
        )}
      </div>
    </Link>
  );
}
