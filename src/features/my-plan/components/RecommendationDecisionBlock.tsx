"use client";

import { motion } from "framer-motion";
import { RefreshCw, Sparkles, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type RecommendationDecisionBlockProps = {
  onDecide: () => void;
  onCatalog: () => void;
  onIdeas: () => void;
  ideasCount?: number;
  hasGenerated?: boolean;
  isGenerating?: boolean;
  compact?: boolean;
};

export function RecommendationDecisionBlock({
  onDecide,
  onCatalog,
  onIdeas,
  hasGenerated = false,
  isGenerating = false,
  compact = false,
}: RecommendationDecisionBlockProps) {
  return (
    <section
      className={cn(
        "space-y-3",
        compact ? "space-y-2.5" : "space-y-3",
      )}
      aria-label="Выбор действия"
    >
      {/* Two equal-weight action cards */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Card 1 — «Реши за меня» */}
        <button
          type="button"
          onClick={onDecide}
          className={cn(
            "group relative flex flex-col items-start gap-2 overflow-hidden rounded-2xl border border-[#F6B69C] p-4 text-left transition-transform duration-200",
            "bg-[linear-gradient(135deg,#FF8F64_0%,#FFB48E_42%,#FFE1D2_100%)] shadow-[0_8px_24px_-12px_rgba(239,135,89,0.55)]",
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
          <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-[#BE4F2E] shadow-sm">
            {hasGenerated ? (
              <RefreshCw className={cn("h-4 w-4", isGenerating && "animate-spin")} />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </span>
          <span className="relative min-w-0">
            <span className="block text-sm font-semibold leading-tight text-neutral-950">
              {hasGenerated ? "Ещё варианты" : "Реши за меня"}
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-neutral-800/75">
              Подберём идеи за пару секунд
            </span>
          </span>
        </button>

        {/* Card 2 — «Сама решу» */}
        <button
          type="button"
          onClick={onCatalog}
          className={cn(
            "group flex flex-col items-start gap-2 rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition-transform duration-200",
            "hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300",
          )}
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
            <BookOpen className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-tight text-neutral-900">
              Сама решу
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-neutral-500">
              Иду в каталог и выбираю
            </span>
          </span>
        </button>
      </div>

      {/* Tertiary link — «Мои идеи» */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onIdeas}
          className="text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-600"
        >
          Мои идеи →
        </button>
      </div>
    </section>
  );
}
