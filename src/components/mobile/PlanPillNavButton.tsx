"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export type PlanPillNavButtonProps = {
  href: string;
  isActive: boolean;
  onOpenMyPlan?: () => void;
  /** Planning-related badge (recommendations, confirmations) — 0 hides */
  badgeCount?: number;
  /**
   * false → подпись «Нет событий» под заголовком.
   * TODO: подставить из стора/апи, когда появятся данные о плане.
   */
  hasPlannedEvents?: boolean;
  className?: string;
  /** Тёмный стеклянный бар (MobileBottomNav) */
  chrome?: "light" | "dark";
};

/**
 * Primary product anchor: «Мой план» — wider pill, strongest visual weight in the bar.
 * Иконка календаря без круга, контент слева с отступом.
 */
export function PlanPillNavButton({
  href,
  isActive,
  onOpenMyPlan,
  badgeCount = 0,
  hasPlannedEvents = false,
  className,
  chrome = "light",
}: PlanPillNavButtonProps) {
  const emptyHintId = "plan-pill-empty-hint";
  const showBadge = badgeCount > 0;
  const showEmptyHint = !hasPlannedEvents;
  const handleClick: React.MouseEventHandler<HTMLAnchorElement> = (event) => {
    if (!onOpenMyPlan) return;
    event.preventDefault();
    onOpenMyPlan();
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      aria-current={isActive ? "page" : undefined}
      aria-describedby={showEmptyHint ? emptyHintId : undefined}
      className={cn(
        "relative flex h-11 min-w-0 flex-1 items-center rounded-full py-0 pl-3 pr-2.5",
        "border transition-all duration-200 ease-out will-change-transform",
        "active:scale-[0.985] active:transition-transform",
        chrome === "dark"
          ? isActive
            ? "border-[#EF8759]/50 bg-gradient-to-b from-neutral-700/70 to-neutral-800/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_6px_20px_rgba(0,0,0,0.35)]"
            : "border-neutral-500/25 bg-neutral-700/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
          : isActive
            ? "border-[#EF8759]/40 bg-gradient-to-b from-white to-[#FFF8F5] shadow-[inset_0_1px_0_rgba(255,255,255,1),0_6px_20px_rgba(239,135,89,0.22)]"
            : "border-white/75 bg-white/65 shadow-sm shadow-black/[0.05]",
        className,
      )}
    >
      <div className="flex w-full min-w-0 items-center gap-2">
        <CalendarDays
          className={cn(
            "h-[18px] w-[18px] shrink-0 stroke-[1.75]",
            chrome === "dark"
              ? isActive
                ? "text-neutral-200"
                : "text-neutral-400"
              : isActive
                ? "text-neutral-500"
                : "text-neutral-400",
          )}
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0 text-left">
          <span
            className={cn(
              "text-sm font-semibold leading-none tracking-tight",
              chrome === "dark"
                ? isActive
                  ? "text-neutral-50"
                  : "text-neutral-200"
                : isActive
                  ? "text-gray-900"
                  : "text-gray-800",
            )}
          >
            Мой план
          </span>
          {showEmptyHint && (
            <span
              id={emptyHintId}
              className={cn(
                "mt-0.5 text-left text-[10px] leading-tight",
                chrome === "dark" ? "text-neutral-400" : "text-neutral-500",
              )}
            >
              Нет событий
            </span>
          )}
        </div>
        {showBadge && (
          <span
            className={cn(
              "ml-auto shrink-0 self-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none",
              chrome === "dark"
                ? isActive
                  ? "bg-[#EF8759]/28 text-orange-100"
                  : "bg-neutral-600/50 text-neutral-200"
                : isActive
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
