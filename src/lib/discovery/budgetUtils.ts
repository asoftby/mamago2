import type { ActivityMock } from "@/types/activity";

/** Максимальная цена среди элементов ленты (priceMin > 0).
 *  Бесплатные и без цены — не участвуют в максимуме.
 *  Возвращает null если нет ни одной платной позиции. */
export function computeMaxBudget(activities: ActivityMock[]): number | null {
  const prices = activities
    .map((a) => a.priceMin)
    .filter((p): p is number => typeof p === "number" && p > 0);
  if (!prices.length) return null;
  return roundUpBudget(Math.max(...prices));
}

/** Округление вверх до удобного числа:
 *  137 → 150, 83 → 90, 22 → 25, 350 → 350. */
export function roundUpBudget(rawMax: number): number {
  if (rawMax <= 30) return Math.ceil(rawMax / 5) * 5;
  if (rawMax <= 100) return Math.ceil(rawMax / 10) * 10;
  if (rawMax <= 300) return Math.ceil(rawMax / 25) * 25;
  return Math.ceil(rawMax / 50) * 50;
}

/** Шаг слайдера в зависимости от диапазона. */
export function getBudgetStep(max: number): number {
  if (max <= 50) return 5;
  if (max <= 200) return 10;
  return 25;
}
