"use client";

import { ArrowRight, Plus } from "lucide-react";

interface PlanStickyCounterProps {
  count: number;
  onClick: () => void;
  compact?: boolean;
  onAdd?: () => void;
}

/**
 * Нижняя панель плана. Главное действие — поле-кнопка «Что нужно сделать?»
 * (открывает экран «Новое дело»), ссылка «Весь план» — тихая. Живёт вне скролла.
 */
export function PlanStickyCounter({ count, onClick, compact = false, onAdd }: PlanStickyCounterProps) {
  if (!onAdd && count <= 0) return null;

  return (
    <div
      className={
        "flex-shrink-0 border-t border-[var(--mp-line)] bg-[var(--mp-bg)] pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] " +
        (compact ? "px-5" : "px-8")
      }
    >
      {onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          className="flex h-[54px] w-full items-center gap-2.5 rounded-2xl border border-[var(--mp-line)] bg-[var(--mp-card)] px-4 text-left text-base font-medium text-[#6F6A65] transition-colors hover:border-[var(--mp-line-strong)]"
        >
          <Plus className="h-5 w-5 text-[var(--mp-ac)]" strokeWidth={2} aria-hidden />
          Что нужно сделать?
        </button>
      ) : null}
      <button
        type="button"
        onClick={onClick}
        className={
          "flex w-full items-center justify-center gap-1.5 text-[15px] font-bold text-[var(--mp-tx2)] transition-colors hover:text-[var(--mp-tx)] " +
          (onAdd ? "mt-1 min-h-11" : "min-h-11")
        }
      >
        {count > 0 ? `Весь план · ${count}` : "Весь план"}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
