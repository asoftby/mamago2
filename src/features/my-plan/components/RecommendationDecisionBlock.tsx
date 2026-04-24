"use client";

import { motion } from "framer-motion";
import { RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type RecommendationDecisionBlockProps = {
  onDecide: () => void;
  onIdeas: () => void;
  ideasCount: number;
  hasGenerated?: boolean;
  isGenerating?: boolean;
  compact?: boolean;
};

export function RecommendationDecisionBlock({
  onDecide,
  onIdeas,
  ideasCount,
  hasGenerated = false,
  isGenerating = false,
  compact = false,
}: RecommendationDecisionBlockProps) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-[#FFD9CA] bg-[linear-gradient(135deg,#FFF5EE_0%,#FFF8F4_46%,#FFFFFF_100%)] p-4 shadow-[0_10px_40px_-20px_rgba(239,135,89,0.45)]",
        compact ? "p-4" : "p-5",
      )}
      aria-label="Подборка дня"
    >
      <button
        type="button"
        onClick={onDecide}
        className={cn(
          "group relative flex w-full items-center gap-3 overflow-hidden rounded-[22px] border border-[#F6B69C] px-5 py-4 text-left transition-transform duration-200",
          "bg-[linear-gradient(135deg,#FF8F64_0%,#FFB48E_42%,#FFE1D2_100%)] shadow-[0_18px_40px_-24px_rgba(239,135,89,0.7)]",
          "hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9B73]/60",
        )}
      >
        <motion.div
          className="absolute inset-0"
          animate={
            isGenerating
              ? {
                  background: [
                    "radial-gradient(circle at 12% 18%, rgba(255,255,255,0.40), transparent 42%)",
                    "radial-gradient(circle at 88% 22%, rgba(255,255,255,0.30), transparent 44%)",
                    "radial-gradient(circle at 58% 86%, rgba(255,255,255,0.28), transparent 46%)",
                    "radial-gradient(circle at 12% 18%, rgba(255,255,255,0.40), transparent 42%)",
                  ],
                }
              : {
                  background:
                    "radial-gradient(circle at top left, rgba(255,255,255,0.38), transparent 42%)",
                }
          }
          transition={
            isGenerating
              ? { duration: 1.1, repeat: 1, ease: "easeInOut" }
              : { duration: 0.2 }
          }
        />
        <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/80 text-[#BE4F2E] shadow-sm">
          {hasGenerated ? (
            <RefreshCw className={cn("h-5 w-5", isGenerating && "animate-spin")} />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block text-lg font-semibold text-neutral-950">
            {hasGenerated ? "Ещё варианты" : "Реши за меня"}
          </span>
          <span className="mt-1 block text-sm leading-snug text-neutral-800/80">
            Подберем идеи за пару секунд
          </span>
        </span>
      </button>

      <div className="my-3 flex items-center gap-3">
        <span className="h-px flex-1 bg-neutral-200" />
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-400">или</span>
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <button
        type="button"
        onClick={onIdeas}
        className="mx-auto flex items-center justify-center text-sm font-medium text-neutral-700 underline decoration-neutral-300 underline-offset-4 transition-colors hover:text-neutral-950"
      >
        Выбрать из идей ({ideasCount})
      </button>
    </section>
  );
}
