"use client";

import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanRecommendationCtaProps {
  onRegenerate: () => void;
  onCatalog: () => void;
  isRegenerating?: boolean;
  compact?: boolean;
  /** Номер текущей подборки, 1-based. */
  batchNumber: number;
  maxBatches: number;
  /** Пул исчерпан раньше лимита подборок — «Ещё варианты» не просто вторичная, а скрыта. */
  isExhausted?: boolean;
}

/**
 * CTA-строка ПОД выдачей, после первой подборки — заменяет слой-0 карточки
 * RecommendationDecisionBlock (те равные по весу, эти — нет): «Ещё варианты»
 * продолжает поток (primary, пока не достигнут лимит), «Или посмотреть каталог» —
 * выход (текстовая ссылка, пока «Ещё варианты» остаётся основным действием).
 * После maxBatches-й подборки или при исчерпании пула акцент переключается.
 */
export function PlanRecommendationCta({
  onRegenerate,
  onCatalog,
  isRegenerating = false,
  compact = false,
  batchNumber,
  maxBatches,
  isExhausted = false,
}: PlanRecommendationCtaProps) {
  const atCap = batchNumber >= maxBatches;
  const showRegenerateButton = !isExhausted && !atCap;
  const catalogIsPrimary = isExhausted || atCap;

  return (
    <div className={cn("flex items-center gap-3", catalogIsPrimary ? "justify-center" : "justify-between", compact && "flex-wrap")}>
      {showRegenerateButton ? (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isRegenerating || atCap}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 min-h-11 rounded-2xl px-5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            catalogIsPrimary
              ? "border border-[var(--mp-line)] bg-[var(--mp-card)] text-[var(--mp-tx)] hover:border-[var(--mp-line-strong)]"
              : "bg-[var(--mp-ac)] text-white hover:bg-[var(--mp-ac-dark)]",
          )}
        >
          <RefreshCw className={cn("h-4 w-4", isRegenerating && "animate-spin")} />
          Ещё варианты
          <span className="text-xs font-normal opacity-80">
            {Math.min(batchNumber, maxBatches)} из {maxBatches}
          </span>
        </button>
      ) : null}
      <button
        type="button"
        onClick={onCatalog}
        className={cn(
          catalogIsPrimary
            ? "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl bg-[var(--mp-ac)] px-5 text-sm font-bold text-white transition-colors hover:bg-[var(--mp-ac-dark)]"
            : "min-h-11 text-sm font-bold text-[var(--mp-tx2)] underline-offset-2 transition-colors hover:text-[var(--mp-tx)] hover:underline",
        )}
      >
        {catalogIsPrimary ? "Смотреть каталог" : "Или посмотреть каталог"}
      </button>
    </div>
  );
}
