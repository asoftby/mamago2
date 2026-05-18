"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CalendarDays, Check, Heart, Ticket } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

export interface EventStickyActionBarProps {
  ctaRef?: React.RefObject<HTMLElement | null>;
  sessionLine?: string;
  priceLabel: string;
  primaryLabel: string;
  secondaryLabel?: string;
  isPlanned?: boolean;
  isSaved?: boolean;
  planDate?: string | null;
  isPrimaryLoading?: boolean;
  isSecondaryLoading?: boolean;
  isPrimaryDisabled?: boolean;
  isSecondaryDisabled?: boolean;
  onPrimary: () => void;
  onSecondary?: () => void;
  onSave?: () => void;
  className?: string;
}

export function EventStickyActionBar({
  ctaRef,
  sessionLine,
  priceLabel,
  primaryLabel,
  secondaryLabel,
  isPlanned = false,
  isSaved = false,
  planDate,
  isPrimaryLoading = false,
  isSecondaryLoading = false,
  isPrimaryDisabled = false,
  isSecondaryDisabled = false,
  onPrimary,
  onSecondary,
  onSave,
  className,
}: EventStickyActionBarProps) {
  const [ctaPassed, setCtaPassed] = useState(false);
  const hasSecondary = Boolean(secondaryLabel && onSecondary);
  const mobilePrimaryAction = hasSecondary && onSecondary ? onSecondary : onPrimary;
  const mobilePrimaryLabel = hasSecondary && secondaryLabel ? secondaryLabel : primaryLabel;
  const mobilePrimaryLoading = hasSecondary ? isSecondaryLoading : isPrimaryLoading;
  const mobilePrimaryDisabled = hasSecondary ? isSecondaryDisabled : isPrimaryDisabled;

  useEffect(() => {
    const el = ctaRef?.current;
    const syncFromScroll = () => {
      if (el) {
        setCtaPassed(el.getBoundingClientRect().bottom <= 0);
        return;
      }
      setCtaPassed(window.scrollY > 280);
    };
    syncFromScroll();
    if (!("IntersectionObserver" in window) || !el) {
      window.addEventListener("scroll", syncFromScroll, { passive: true });
      return () => window.removeEventListener("scroll", syncFromScroll);
    }
    const observer = new IntersectionObserver(
      ([entry]) => setCtaPassed(!(entry?.isIntersecting ?? true)),
      { threshold: 0 },
    );
    observer.observe(el);
    window.addEventListener("scroll", syncFromScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", syncFromScroll);
    };
  }, [ctaRef]);

  const compactPlanLabel = planDate
    ? format(parseISO(planDate), "d MMMM", { locale: ru })
    : null;

  /* ── Desktop top sticky bar ── */
  const TopBar = (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-40 hidden lg:block",
        "transition-transform duration-200 ease-out",
        ctaPassed ? "translate-y-0 pointer-events-auto" : "-translate-y-full pointer-events-none",
        "border-b border-[rgba(20,18,16,0.10)] bg-[rgba(250,247,241,0.95)] backdrop-blur-md",
        "shadow-[0_4px_20px_rgba(20,18,16,0.08)] py-3",
        className,
      )}
      role="region"
      aria-label="Действия с событием"
      aria-hidden={!ctaPassed}
    >
      <div className="mx-auto flex w-full max-w-[1320px] items-center gap-4 px-4 sm:px-6 lg:px-7">
        <div className="min-w-0 flex-1">
          {sessionLine && (
            <p className="truncate font-mono text-[11px] uppercase tracking-[0.06em] text-[#C24E22]">
              ● {sessionLine}
            </p>
          )}
          <p className="font-[family-name:var(--font-display)] text-[28px] leading-none tracking-[-0.02em] text-[#141210]">
            {priceLabel}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onPrimary}
            disabled={isPrimaryDisabled || isPrimaryLoading}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full px-5 text-[14px] font-semibold transition-colors",
              isPlanned
                ? "border border-[#E86A3A] bg-[#FFE8DC] text-[#C24E22]"
                : "bg-[#E86A3A] text-white hover:bg-[#C24E22]",
            )}
          >
            {isPrimaryLoading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : isPlanned ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span className="sm:hidden">{compactPlanLabel ?? primaryLabel}</span>
                <span className="hidden sm:inline">{primaryLabel}</span>
              </>
            ) : (
              primaryLabel
            )}
          </button>
          {hasSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              disabled={isSecondaryDisabled || isSecondaryLoading}
              className="inline-flex h-10 items-center rounded-full border border-[rgba(20,18,16,0.18)] px-5 text-[14px] font-semibold text-[#141210] transition-colors hover:border-[#141210]"
            >
              {isSecondaryLoading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                secondaryLabel
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  /* ── Mobile bottom bar ── */
  const BottomBar = (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex lg:hidden",
        "items-center gap-2.5 px-3.5 py-2.5",
        "border-t border-[rgba(20,18,16,0.10)] bg-[rgba(250,247,241,0.95)] backdrop-blur-[14px]",
        "shadow-[0_-10px_30px_-10px_rgba(20,18,16,0.18)]",
        "pb-[calc(0.625rem+env(safe-area-inset-bottom))]",
      )}
      role="region"
      aria-label="Действия с событием"
    >
      {/* Big orange CTA */}
      <button
        type="button"
        onClick={mobilePrimaryAction}
        disabled={mobilePrimaryDisabled || mobilePrimaryLoading}
        className="flex flex-1 h-[52px] items-center justify-center gap-2.5 rounded-full bg-[#E86A3A] text-[15px] font-semibold text-white transition-colors hover:bg-[#C24E22] active:translate-y-px"
      >
        {mobilePrimaryLoading ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <>
            {hasSecondary ? (
              <Ticket className="h-4 w-4 shrink-0" />
            ) : (
              <CalendarDays className="h-4 w-4 shrink-0" />
            )}
            {mobilePrimaryLabel}
          </>
        )}
      </button>

      {/* Heart save button */}
      <button
        type="button"
        onClick={onSave}
        aria-label="Сохранить в план или идеи"
        className={cn(
          "flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border transition-colors",
          isSaved
            ? "border-[#E86A3A] bg-[#FFE8DC] text-[#E86A3A]"
            : "border-[rgba(20,18,16,0.18)] bg-transparent text-[rgba(20,18,16,0.55)] hover:border-[#141210] hover:text-[#141210]",
        )}
      >
        <Heart className={cn("h-5 w-5", isSaved && "fill-[#E86A3A]")} />
      </button>
    </div>
  );

  return (
    <>
      {TopBar}
      {BottomBar}
    </>
  );
}
