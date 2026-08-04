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
  const showRegenerateButton = !isExhausted;
  const catalogIsPrimary = isExhausted || atCap;

  return (
    <div className={cn("flex items-center justify-between gap-3", compact && "flex-wrap")}>
      {showRegenerateButton ? (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isRegenerating || atCap}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            catalogIsPrimary
              ? "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
              : "bg-[#EF8759] text-white hover:bg-[#e17a48]",
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
            ? "inline-flex shrink-0 items-center gap-2 rounded-full bg-[#EF8759] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#e17a48]"
            : "text-sm font-medium text-neutral-600 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline",
        )}
      >
        {catalogIsPrimary ? "Смотреть каталог" : "Или посмотреть каталог"}
      </button>
    </div>
  );
}
