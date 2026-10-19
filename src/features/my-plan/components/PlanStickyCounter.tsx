"use client";

import { PlanAddTaskButton } from "./PlanAddTaskButton";

interface PlanStickyCounterProps {
  compact?: boolean;
  onAdd?: () => void;
}

/**
 * Нижняя «стеклянная» кнопка плана «Что нужно сделать?» (открывает экран «Новое дело»).
 * Парит над списком, список добирает нижний отступ. Ссылка «Весь план» живёт под «Где мы были».
 */
export function PlanStickyCounter({ compact = false, onAdd }: PlanStickyCounterProps) {
  if (!onAdd) return null;

  return (
    <div
      className={
        "pointer-events-none absolute inset-x-0 bottom-0 z-10 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] " +
        (compact ? "px-5" : "px-8")
      }
    >
      <PlanAddTaskButton onClick={onAdd} />
    </div>
  );
}
