"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanStickyCounterProps {
  count: number;
  onClick: () => void;
  compact?: boolean;
}

/**
 * Единственная обратная связь на «Добавить в план» — залипающий счётчик, не тост.
 * Пустой план → компонент не рендерит ничего. Живёт вне скролла результатов
 * (пиннится, как MyPlanHeader), не привязан к слою (виден и до, и после выдачи).
 */
export function PlanStickyCounter({ count, onClick, compact = false }: PlanStickyCounterProps) {
  if (count <= 0) return null;

  return (
    <div
      className={cn(
        "flex-shrink-0 border-t border-[rgba(20,18,16,.10)] bg-[#FAF7F1]",
        compact ? "px-5 py-3" : "px-6 py-3.5",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between text-sm font-semibold text-[#141210] transition-opacity hover:opacity-70"
      >
        <span>В плане: {count}</span>
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
