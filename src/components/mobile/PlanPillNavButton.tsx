"use client";

import Link from "next/link";
import { PlanCalendarIcon } from "@/components/icons/PlanCalendarIcon";
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
        "relative flex h-[52px] min-w-0 flex-1 items-center rounded-full px-5 py-0",
        "border transition-all duration-200 ease-out will-change-transform cursor-pointer touch-manipulation",
        chrome === "dark"
          ? cn(
              "border-gray-200 bg-white shadow-sm active:scale-[0.98]",
              isActive && "border-[#EF8759]/40",
            )
          : cn(
              "active:scale-[0.985] active:transition-transform",
              isActive
                ? "border-[#EF8759]/40 bg-gradient-to-b from-white to-[#FFF8F5] shadow-[inset_0_1px_0_rgba(255,255,255,1),0_6px_20px_rgba(239,135,89,0.22)]"
                : "border-white/75 bg-white/65 shadow-sm shadow-black/[0.05]",
            ),
        className,
      )}
    >
      <div className="flex w-full min-w-0 items-center gap-2">
        <PlanCalendarIcon
          className={cn(
            chrome === "dark" ? "h-5 w-5" : "h-[18px] w-[18px]",
            chrome === "dark"
              ? isActive
                ? "text-[#C24E22]"
                : "text-gray-400"
              : isActive
                ? "text-neutral-500"
                : "text-neutral-400",
          )}
        />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0 text-left">
          <span
            className={cn(
              "block min-w-0 truncate text-left text-sm font-normal",
              guestPlanPromo ? "leading-snug" : "leading-none",
              "text-gray-700",
            )}
          >
            {guestPlanPromo ? (
              <>
                Мой план{" "}
                <em style={{ fontFamily: "var(--font-editorial)", fontStyle: "italic", color: "#C24E22" }}>
                  за 10 секунд
                </em>
              </>
            ) : "Мой план"}
          </span>
          {showEmptyHint && (
            <span
              id={emptyHintId}
              className="mt-0.5 block truncate text-left text-xs leading-tight text-neutral-400"
            >
              {guestPlanPromo ? (
                "Подберём активности под вас"
              ) : (
                <>
                  <span className="text-neutral-900">Нет событий —</span>{" "}
                  <em className="font-pt-serif italic text-primary">
                    соберём за 10 секунд
                  </em>
                </>
              )}
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
