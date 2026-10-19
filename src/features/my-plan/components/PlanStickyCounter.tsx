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
        className="pointer-events-auto relative isolate flex h-[60px] w-full items-center gap-3 overflow-hidden rounded-[20px] border border-white/90 bg-gradient-to-br from-white/80 to-white/40 pl-[18px] pr-2 text-left text-[16.5px] font-semibold text-[var(--mp-tx)] shadow-[0_10px_28px_-10px_color-mix(in_srgb,var(--brand)_40%,transparent),0_2px_6px_rgba(26,20,16,.08),inset_0_1px_0_#fff] backdrop-blur-[18px] backdrop-saturate-[1.6] transition-[transform,box-shadow] hover:-translate-y-px active:translate-y-px"
      >
        <span
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(120%_140%_at_0%_0%,var(--brand-soft),transparent_55%),radial-gradient(90%_120%_at_100%_100%,var(--success-soft),transparent_60%)]"
        />
        <span aria-hidden className="pointer-events-none absolute inset-x-3 top-px h-[45%] rounded-[18px_18px_40px_40px] bg-gradient-to-b from-white/75 to-white/0" />
        <span className="flex-1">Что нужно сделать?</span>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[var(--mp-ac)] text-white shadow-[0_6px_14px_-4px_color-mix(in_srgb,var(--brand)_60%,transparent),inset_0_1px_0_rgba(255,255,255,.35)]">
          <Plus className="h-[22px] w-[22px]" strokeWidth={2.4} aria-hidden />
        </span>
      </button>
      </div>
    </div>
  );
}
