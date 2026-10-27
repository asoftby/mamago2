import type { BirthdayBudgetGroup } from "../../types/birthday";

/** Budget group → [min, max] in BYN */
export const BUDGET_RANGES: Record<BirthdayBudgetGroup, [number, number]> = {
  up300: [0, 300],
  "300-600": [300, 600],
  "600-1000": [600, 1000],
  "1000plus": [1000, 99999],
  unknown: [0, 99999],
};

export function getBudgetRange(
  budgetGroup: BirthdayBudgetGroup | null
): { min: number; max: number } | null {
  if (!budgetGroup || budgetGroup === "unknown") return null;
  const [min, max] = BUDGET_RANGES[budgetGroup];
  return { min, max };
}

/** Upper bound the parent chose, in BYN; null when the group has no upper limit. */
export function budgetMaxByn(budgetGroup: BirthdayBudgetGroup | null): number | null {
  const range = getBudgetRange(budgetGroup);
  return range && range.max < 99999 ? range.max : null;
}

export function formatBudgetRange(budgetGroup: BirthdayBudgetGroup | null): string {
  const range = getBudgetRange(budgetGroup);
  if (!range) return "—";
  if (range.max >= 99999) return `${range.min}+`;
  return `${range.min}–${range.max}`;
}
