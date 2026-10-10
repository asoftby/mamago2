"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type RecommendationDecisionBlockProps = {
  onDecide: () => void;
  isGenerating?: boolean;
  compact?: boolean;
};

export function RecommendationDecisionBlock({
  onDecide,
  isGenerating = false,
  compact = false,
}: RecommendationDecisionBlockProps) {
  return (
    <section
      className={cn(compact ? "px-0 pt-1" : "px-0 pt-2")}
      aria-label="Подбор рекомендаций"
    >
      <button
        type="button"
        onClick={onDecide}
        disabled={isGenerating}
        className="flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--mp-ac)] text-base font-bold text-white transition-colors hover:bg-[var(--mp-ac-dark)] disabled:cursor-default disabled:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mp-ac)]"
      >
        {isGenerating ? (
          <RefreshCw className="h-[18px] w-[18px] animate-spin" />
        ) : (
          <Sparkles className="h-[18px] w-[18px]" />
        )}
        {isGenerating ? "Подбираем события…" : "Подобрать события"}
      </button>
    </section>
  );
}
