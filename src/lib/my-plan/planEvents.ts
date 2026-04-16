"use client";

import { useEffect } from "react";

/**
 * Глобальное событие, которое выбрасывается при изменении (добавлении или удалении)
 * событий в планах или идеях, чтобы все подписчики (например, виджет Мой план)
 * могли синхронизировать локальное состояние в реальном времени.
 */
export const MY_PLAN_CHANGED_EVENT = "my-plan:changed";

/**
 * Выбросить событие об изменении в плане или идеях.
 * Вызывается после любых успешных мутаций через API в компонентах-потребителях.
 */
export function dispatchPlanChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MY_PLAN_CHANGED_EVENT));
  }
}

/**
 * Хук для прослушивания события изменения плана.
 */
export function usePlanChangedListener(callback: () => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    window.addEventListener(MY_PLAN_CHANGED_EVENT, callback);
    return () => {
      window.removeEventListener(MY_PLAN_CHANGED_EVENT, callback);
    };
  }, [callback]);
}
