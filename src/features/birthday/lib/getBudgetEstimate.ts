import { BYN_SYMBOL } from "@/lib/formatters/format-price";
import type { BirthdayBudgetGroup, BirthdayOffer } from "../types/birthday";

export function getBudgetEstimate(
  offers: BirthdayOffer[],
  budgetGroup: BirthdayBudgetGroup | null
): number | null {
  if (!offers.length) return null;
  const prices = offers
    .filter((o) => o.priceFrom !== undefined)
    .map((o) => o.priceFrom as number);
  if (!prices.length) return null;
  return prices.reduce((sum, p) => sum + p, 0);
}

export function formatBudget(amount: number): string {
  return `от ${amount} ${BYN_SYMBOL}`;
}
