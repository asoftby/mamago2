"use client";

import { Plus } from "lucide-react";
import { MY_PLAN_V3_TOKENS } from "./v3/myPlanV3Tokens";

interface PlanStickyCounterProps {
  compact?: boolean;
  onAdd?: () => void;
  /** Страница плана (`/me/plan`): кнопка парит над окном (fixed), а не внутри шторки виджета (absolute). */
  floating?: boolean;
}

/**
 * Нижняя «стеклянная» кнопка плана «Что нужно сделать?» (открывает экран «Новое дело»).
 * Парит над списком, список добирает нижний отступ. Ссылка «Весь план» живёт под «Где мы уже были».
 */
export function PlanStickyCounter({ compact = false, onAdd, floating = false }: PlanStickyCounterProps) {
  if (!onAdd) return null;

  return (
    <div
      // Вне виджета (страница плана) токены --mp-* не заданы предками — ставим их на самой кнопке.
      style={floating ? MY_PLAN_V3_TOKENS : undefined}
      className={
        "pointer-events-none inset-x-0 bottom-0 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] " +
        (floating ? "fixed z-40 px-4 " : "absolute z-10 " + (compact ? "px-5" : "px-8"))
      }
    >
      <div className={floating ? "mx-auto w-full max-w-[560px]" : undefined}>
      <button
        type="button"
        onClick={onAdd}
        className="pointer-events-auto relative flex h-[60px] w-full items-center gap-3 overflow-hidden rounded-[20px] border border-white bg-[#ffe4d7] pl-[18px] pr-2 text-left text-[16.5px] font-semibold text-[var(--mp-tx)] transition-colors hover:bg-[#ffdac9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="flex-1">Что нужно сделать?</span>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#f77c49] text-white">
          <Plus className="h-[22px] w-[22px]" strokeWidth={2.4} aria-hidden />
        </span>
      </button>
      </div>
    </div>
  );
}
