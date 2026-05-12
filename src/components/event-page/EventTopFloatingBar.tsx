"use client";

import { useEffect, useRef } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface EventTopFloatingBarProps {
  visible: boolean;
  sessionLine?: string;
  priceLabel: string;
  primaryLabel: string;
  secondaryLabel?: string;
  isPlanned?: boolean;
  isPrimaryLoading?: boolean;
  isSecondaryLoading?: boolean;
  onPrimary: () => void;
  onSecondary?: () => void;
}

/**
 * Airbnb-style top floating CTA bar для desktop.
 * Появляется когда основной CTA-блок (EventDecisionPanel) уходит из viewport.
 * Скрыт на mobile — там работает bottom bar.
 */
export function EventTopFloatingBar({
  visible,
  sessionLine,
  priceLabel,
  primaryLabel,
  secondaryLabel,
  isPlanned = false,
  isPrimaryLoading = false,
  isSecondaryLoading = false,
  onPrimary,
  onSecondary,
}: EventTopFloatingBarProps) {
  const hasSecondary = Boolean(secondaryLabel && onSecondary);
  const barRef = useRef<HTMLDivElement>(null);

  // Снимаем фокус при скрытии — предотвращает
  // "Blocked aria-hidden on an element because its descendant retained focus"
  useEffect(() => {
    if (visible) return;
    const el = barRef.current;
    if (!el) return;
    if (el.contains(document.activeElement) && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [visible]);

  return (
    <div
      ref={barRef}
      // inert блокирует фокус и AT для скрытого бара (замена aria-hidden для интерактивных контейнеров)
      inert={!visible}
      className={cn(
        // Только desktop
        "hidden lg:block",
        // Позиция
        "fixed inset-x-0 top-0 z-40",
        // Визуал
        "border-b border-border/50 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/90",
        "shadow-[0_4px_24px_rgba(15,23,42,0.07)]",
        // Анимация
        "transition-[transform,opacity] duration-200 ease-out",
        visible
          ? "translate-y-0 opacity-100"
          : "-translate-y-full opacity-0 pointer-events-none",
      )}
      role="region"
      aria-label="Быстрые действия с событием"
    >
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-6 px-4 py-3 sm:px-6 lg:px-8">
        {/* Левая часть: дата + цена */}
        <div className="min-w-0 flex-1">
          {sessionLine && (
            <p className="truncate text-[13px] text-muted-foreground leading-tight">
              {sessionLine}
            </p>
          )}
          <p className="text-[15px] font-semibold text-foreground leading-tight">
            {priceLabel}
          </p>
        </div>

        {/* Правая часть: кнопки */}
        <div className="flex shrink-0 items-center gap-2">
          <PrimaryButton
            type="button"
            className={cn(
              "h-12 rounded-2xl px-6 text-[14px] font-semibold",
              isPlanned && "gap-2",
            )}
            onClick={onPrimary}
            disabled={isPrimaryLoading}
          >
            {isPrimaryLoading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <>
                {isPlanned && <Check className="h-4 w-4 shrink-0" />}
                {primaryLabel}
              </>
            )}
          </PrimaryButton>

          {hasSecondary && (
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-2xl px-6 text-[14px] font-semibold border-border/80 hover:border-border hover:bg-accent/50"
              onClick={onSecondary}
              disabled={isSecondaryLoading}
            >
              {isSecondaryLoading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
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
