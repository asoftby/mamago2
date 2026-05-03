"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

export interface EventStickyActionBarProps {
  ctaRef?: React.RefObject<HTMLElement | null>;
  sessionLine?: string;
  priceLabel: string;
  primaryLabel: string;
  secondaryLabel?: string;
  isPlanned?: boolean;
  /** ISO дата в плане — для компактного текста на мобильном "✓ 30 апреля" */
  planDate?: string | null;
  isPrimaryLoading?: boolean;
  isSecondaryLoading?: boolean;
  isPrimaryDisabled?: boolean;
  isSecondaryDisabled?: boolean;
  onPrimary: () => void;
  onSecondary?: () => void;
  className?: string;
}

export function EventStickyActionBar({
  ctaRef,
  sessionLine,
  priceLabel,
  primaryLabel,
  secondaryLabel,
  isPlanned = false,
  planDate,
  isPrimaryLoading = false,
  isSecondaryLoading = false,
  isPrimaryDisabled = false,
  isSecondaryDisabled = false,
  onPrimary,
  onSecondary,
  className,
}: EventStickyActionBarProps) {
  const [visible, setVisible] = useState(false);
  const hasSecondary = Boolean(secondaryLabel && onSecondary);

  useEffect(() => {
    const el = ctaRef?.current;
    const syncFromScroll = () => {
      if (el) {
        const rect = el.getBoundingClientRect();
        setVisible(rect.bottom <= 0);
        return;
      }
      setVisible(window.scrollY > 280);
    };

    syncFromScroll();

    if (!("IntersectionObserver" in window) || !el) {
      window.addEventListener("scroll", syncFromScroll, { passive: true });
      window.addEventListener("resize", syncFromScroll);
      return () => {
        window.removeEventListener("scroll", syncFromScroll);
        window.removeEventListener("resize", syncFromScroll);
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!(entry?.isIntersecting ?? true)),
      { threshold: 0 },
    );
    observer.observe(el);
    window.addEventListener("scroll", syncFromScroll, { passive: true });
    window.addEventListener("resize", syncFromScroll);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", syncFromScroll);
      window.removeEventListener("resize", syncFromScroll);
    };
  }, [ctaRef]);

  // Компактный текст для мобильного: "✓ 30 апреля"
  const compactPlanLabel = planDate
    ? format(parseISO(planDate), "d MMMM", { locale: ru })
    : null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-40",
        "transition-transform duration-200 ease-out",
        visible ? "translate-y-0 pointer-events-auto" : "-translate-y-full pointer-events-none",
        "border-b border-border/60 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85",
        "shadow-[0_4px_20px_rgba(15,23,42,0.08)]",
        "pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]",
        className,
      )}
      role="region"
      aria-label="Действия с событием"
      aria-hidden={!visible}
    >
      {/* Всегда одна строка: левая часть + кнопки справа */}
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Левая часть: дата и цена */}
        <div className="min-w-0 flex-1">
          {sessionLine && (
            <p className="truncate text-[12px] text-muted-foreground leading-tight">
              {sessionLine}
            </p>
          )}
          <p className="text-[15px] font-semibold text-foreground leading-tight">{priceLabel}</p>
        </div>

        {/* Правая часть: кнопки */}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-9 rounded-xl px-4 text-[13px] font-semibold",
              isPlanned
                ? "gap-1.5 border-[#EF8759] bg-[#FFF7F3] text-[#EF8759] hover:bg-[#FFF0E8]"
                : "border-border/80 hover:border-border hover:bg-accent/50",
            )}
            onClick={onPrimary}
            disabled={isPrimaryDisabled || isPrimaryLoading}
          >
            {isPrimaryLoading ? (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : isPlanned ? (
              <>
                <Check className="h-3.5 w-3.5 shrink-0" />
                {/* Мобильный: компактно "30 апреля", десктоп: полный текст */}
                <span className="sm:hidden">{compactPlanLabel ?? primaryLabel}</span>
                <span className="hidden sm:inline">{primaryLabel}</span>
              </>
            ) : (
              primaryLabel
            )}
          </Button>

          {hasSecondary && (
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-xl px-4 text-[13px] font-semibold border-border/80 hover:border-border hover:bg-accent/50"
              onClick={onSecondary}
              disabled={isSecondaryDisabled || isSecondaryLoading}
            >
              {isSecondaryLoading ? (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                secondaryLabel
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
