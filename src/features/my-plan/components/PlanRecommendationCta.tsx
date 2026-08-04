"use client";

import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanRecommendationCtaProps {
  onRegenerate: () => void;
  onCatalog: () => void;
  isRegenerating?: boolean;
  compact?: boolean;
}

/**
 * CTA-строка ПОД выдачей, после первой подборки — заменяет слой-0 карточки
 * RecommendationDecisionBlock (те равные по весу, эти — нет): «Ещё варианты»
 * продолжает поток (primary), «Сама решу» — выход в каталог (текстовая ссылка).
 */
export function PlanRecommendationCta({
  onRegenerate,
  onCatalog,
  isRegenerating = false,
  compact = false,
}: PlanRecommendationCtaProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", compact && "flex-wrap")}>
      <button
        type="button"
        onClick={onRegenerate}
        disabled={isRegenerating}
        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#EF8759] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#e17a48] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className={cn("h-4 w-4", isRegenerating && "animate-spin")} />
        Ещё варианты
      </button>
      <button
        type="button"
        onClick={onCatalog}
        className="text-sm font-medium text-neutral-600 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline"
      >
        Или посмотреть каталог
      </button>
    </div>
  );
}
