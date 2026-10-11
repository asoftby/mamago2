"use client";

import { Plus } from "lucide-react";

interface PlanStickyCounterProps {
  compact?: boolean;
  onAdd?: () => void;
}

/**
 * Нижняя панель плана: только поле-кнопка «Что нужно сделать?» (открывает экран «Новое дело»).
 * Ссылка «Весь план» живёт в списке под «Где мы уже были». Живёт вне скролла.
 */
export function PlanStickyCounter({ compact = false, onAdd }: PlanStickyCounterProps) {
  if (!onAdd) return null;

  return (
    <div
      className={
        "flex-shrink-0 border-t border-[var(--mp-line)] bg-[var(--mp-bg)] pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] " +
        (compact ? "px-5" : "px-8")
      }
    >
      <button
        type="button"
        onClick={onAdd}
        className="flex h-[54px] w-full items-center gap-2.5 rounded-2xl border border-[var(--mp-line)] bg-[var(--mp-card)] px-4 text-left text-base font-medium text-[#6F6A65] transition-colors hover:border-[var(--mp-line-strong)]"
      >
        <Plus className="h-5 w-5 text-[var(--mp-ac)]" strokeWidth={2} aria-hidden />
        Что нужно сделать?
      </button>
    </div>
  );
}
