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
 * Нижняя «стеклянная» кнопка плана «Добавим что-нибудь?» (открывает экран «Новое дело»).
 * Парит над списком, список добирает нижний отступ. Ссылка «Весь план» живёт под «Где мы уже были».
 */
export function PlanStickyCounter({ onAdd, floating = false }: PlanStickyCounterProps) {
  if (!onAdd) return null;

  return (
    <div
      // Вне виджета (страница плана) токены --mp-* не заданы предками — ставим их на самой кнопке.
      style={floating ? MY_PLAN_V3_TOKENS : undefined}
      className={
        "pointer-events-none inset-x-0 bottom-0 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] " +
        (floating ? "" : "bg-gradient-to-t from-[var(--mp-bg)] from-60% to-transparent ") +
        (floating ? "fixed z-40 px-4 " : "absolute z-10 px-3.5")
      }
    >
      <div className={floating ? "mx-auto w-full max-w-[560px]" : undefined}>
      <button
        type="button"
        onClick={onAdd}
        className="group pointer-events-auto relative flex min-h-[62px] w-full items-center gap-3 overflow-hidden rounded-[20px] border border-[#f7d2c0] bg-[var(--mp-ac-soft)] py-2 pl-[18px] pr-2 text-left text-[15px] font-semibold tracking-[-.01em] text-[var(--mp-tx)] transition-colors hover:bg-[#ffdfcf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="flex-1">Добавим что-нибудь?</span>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--mp-ac)] text-white transition-transform group-hover:scale-105">
          <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden />
        </span>
      </button>
      </div>
    </div>
  );
}
