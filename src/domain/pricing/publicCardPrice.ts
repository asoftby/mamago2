import { formatPrice, formatPriceFrom } from "@/lib/formatters/format-price";
import type { PublicationPriceMode } from "./normalizedPrice";

export type PublicCardPriceInput = {
  priceMode: PublicationPriceMode | null | undefined;
  priceFrom: number | null | undefined;
  priceTo?: number | null;
  currency?: string | null;
};

/** Compact public cards always show the lowest proven entry price. */
export function formatPublicCardPrice(input: PublicCardPriceInput): string | null {
  const { priceMode, priceFrom } = input;
  if (priceMode === "FREE") return "Бесплатно";
  if (priceMode === "NONE" || priceMode === "UNKNOWN" || !priceMode) return null;
  if (typeof priceFrom !== "number" || !Number.isFinite(priceFrom) || priceFrom < 0) return null;
  if (priceMode === "EXACT") return formatPrice(priceFrom, { hideZero: true });
  if (priceMode === "FROM" || priceMode === "RANGE") return formatPriceFrom(priceFrom, { hideZero: true });
  return null;
}
