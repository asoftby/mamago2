import { formatPrice, formatPriceFrom } from "@/lib/formatters/format-price";

export function formatPriceBr(
  value: number | null | undefined,
  options?: { from?: boolean },
): string {
  return options?.from ? formatPriceFrom(value) : formatPrice(value, { hideZero: true });
}
