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
  /**
   * Гость: те же формулировки, что у десктопного MyPlanWidget
   * («Мой план за 10 секунд» / «Подберём активности под вас»).
   */
  guestPlanPromo?: boolean;
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
  guestPlanPromo = false,
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
        "border transition-all duration-200 ease-out will-change-transform cursor-pointer touch-manipulation",
        "active:scale-[0.985] active:transition-transform",
        chrome === "dark"
          ? isActive
            ? "border-[#EF8759]/50 bg-[rgba(250,247,241,0.50)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_6px_20px_rgba(239,135,89,0.18)]"
            : "border-[rgba(250,247,241,0.25)] bg-[rgba(250,247,241,0.50)] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
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
              ? isActive ? "text-neutral-800" : "text-neutral-700"
              : isActive
                ? "text-neutral-500"
                : "text-neutral-400",
          )}
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0 text-left">
          <span
            className={cn(
              "tracking-tight",
              guestPlanPromo ? "leading-snug line-clamp-2" : "leading-none",
              chrome === "dark"
                ? isActive ? "text-neutral-900" : "text-neutral-800"
                : isActive ? "text-gray-900" : "text-gray-800",
            )}
            style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: guestPlanPromo ? 13 : 15 }}
          >
            {guestPlanPromo ? (
              <>Мой план <em style={{ fontStyle: "italic", color: "#C24E22" }}>за 10 секунд</em></>
            ) : "Мой план"}
          </span>
          {showEmptyHint && (
            <span
              id={emptyHintId}
              className={cn(
                "mt-0.5 text-left text-[10px] leading-tight font-sans",
                chrome === "dark" ? "text-neutral-700" : "text-neutral-500",
              )}
              style={{ fontFamily: "var(--font-sans), sans-serif" }}
            >
              {guestPlanPromo
                ? "Подберём активности под вас"
                : "Нет событий — соберём за 10 секунд"}
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
