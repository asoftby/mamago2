"use client";

import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface EventStickyActionBarProps {
  /** Краткая информация о дате/времени */
  sessionLine?: string;
  /** Цена для отображения */
  priceLabel: string;
  /** Текст primary CTA */
  primaryLabel: string;
  /** Текст secondary CTA (опционально) */
  secondaryLabel?: string;
  /** Событие уже в плане */
  isPlanned?: boolean;
  /** Loading состояние для primary action */
  isPrimaryLoading?: boolean;
  /** Loading состояние для secondary action */
  isSecondaryLoading?: boolean;
  /** Disabled состояние для primary action */
  isPrimaryDisabled?: boolean;
  /** Disabled состояние для secondary action */
  isSecondaryDisabled?: boolean;
  /** Обработчик primary action */
  onPrimary: () => void;
  /** Обработчик secondary action */
  onSecondary?: () => void;
  /** Дополнительные классы */
  className?: string;
}

/**
 * Sticky bottom action bar для страницы события.
 * 
 * Planning-first подход:
 * - Primary CTA: "Запланировать" (всегда главное действие)
 * - Secondary CTA: "Купить билет" / "Записаться" (опционально)
 * 
 * Визуальный приоритет:
 * - Primary = filled button в brand color
 * - Secondary = outline button
 */
export function EventStickyActionBar({
  sessionLine,
  priceLabel,
  primaryLabel,
  secondaryLabel,
  isPlanned = false,
  isPrimaryLoading = false,
  isSecondaryLoading = false,
  isPrimaryDisabled = false,
  isSecondaryDisabled = false,
  onPrimary,
  onSecondary,
  className,
}: EventStickyActionBarProps) {
  const hasSecondary = Boolean(secondaryLabel && onSecondary);

  return (
    <div
      className={cn(
        // Фиксация и z-index
        "fixed inset-x-0 bottom-0 z-50",
        // Визуальный стиль: premium blur + тень
        "border-t border-border/60 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85",
        "shadow-[0_-10px_40px_rgba(15,23,42,0.08)]",
        // Safe area для мобильных устройств
        "pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3",
        className
      )}
      role="region"
      aria-label="Действия с событием"
    >
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 lg:px-8">
        {/* Левая часть: цена и дата */}
        <div className="min-w-0 flex-1">
          {sessionLine && (
            <p className="truncate text-[13px] text-muted-foreground">
              {sessionLine}
            </p>
          )}
          <p className="text-lg font-semibold text-foreground">{priceLabel}</p>
        </div>

        {/* Правая часть: CTA кнопки */}
        <div className="flex shrink-0 gap-2 sm:justify-end">
          {/* Primary CTA: Запланировать */}
          <PrimaryButton
            type="button"
            className={cn(
              "h-11 flex-1 rounded-2xl px-5 text-[14px] font-semibold",
              "sm:flex-none sm:min-w-[140px]",
              // Если уже в плане, показываем галочку
              isPlanned && "gap-1.5"
            )}
            onClick={onPrimary}
            disabled={isPrimaryDisabled || isPrimaryLoading}
            aria-label={isPlanned ? "Управление планом" : "Запланировать событие"}
          >
            {isPrimaryLoading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : isPlanned ? (
              <>
                <Check className="h-4 w-4" />
                {primaryLabel}
              </>
            ) : (
              primaryLabel
            )}
          </PrimaryButton>

          {/* Secondary CTA: Купить билет / Записаться */}
          {hasSecondary && (
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-11 flex-1 rounded-2xl px-5 text-[14px] font-semibold",
                "sm:flex-none sm:min-w-[140px]",
                // Визуально вторичная кнопка
                "border-border/80 hover:border-border hover:bg-accent/50"
              )}
              onClick={onSecondary}
              disabled={isSecondaryDisabled || isSecondaryLoading}
              aria-label={secondaryLabel}
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
