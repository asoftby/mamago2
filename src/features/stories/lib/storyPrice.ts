import type { PublicationPriceMode } from "@/domain/pricing/normalizedPrice";
import {
  formatPrice,
  formatPriceFrom,
  formatPriceRange,
  normalizeUiCurrencyText,
} from "@/lib/formatters/format-price";

export type StoryPriceInput = {
  priceMode?: PublicationPriceMode | null;
  priceFrom?: number | null;
  priceTo?: number | null;
  priceText?: string | null;
};

function parseNumber(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatLegacyStoryPrice(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;

  if (/бесплат/i.test(raw)) return "Бесплатно";

  const range = raw.match(/(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)/u);
  if (range) {
    const from = parseNumber(range[1]!);
    const to = parseNumber(range[2]!);
    if (from != null && to != null) {
      return formatPriceRange(from, to, { hideZero: true }) || undefined;
    }
  }

  const fromMatch = raw.match(/(?:^|\s)от\s*(\d+(?:[.,]\d+)?)/iu);
  if (fromMatch) {
    const from = parseNumber(fromMatch[1]!);
    if (from != null) return formatPriceFrom(from, { hideZero: true }) || undefined;
  }

  const exact = raw.match(/^\s*(\d+(?:[.,]\d+)?)\s*(?:BYN|Br|руб\.?|р\.?)?\s*$/iu);
  if (exact) {
    const amount = parseNumber(exact[1]!);
    if (amount != null) return formatPrice(amount, { hideZero: true }) || undefined;
  }

  return normalizeUiCurrencyText(raw) || undefined;
}

/**
 * Stories show a complete public price:
 * EXACT -> 25,00 [BYN symbol]
 * FROM  -> от 25,00 [BYN symbol]
 * RANGE -> 25,00–40,00 [BYN symbol]
 * FREE  -> Бесплатно
 *
 * Structured priceMode is authoritative. Legacy priceText is parsed only
 * when mode is missing/UNKNOWN, so old imported stories still get normalized.
 */
export function formatStoryPrice(input: StoryPriceInput): string | undefined {
  switch (input.priceMode) {
    case "FREE":
      return "Бесплатно";
    case "EXACT":
      return input.priceFrom != null
        ? formatPrice(input.priceFrom, { hideZero: true }) || undefined
        : undefined;
    case "FROM":
      return input.priceFrom != null
        ? formatPriceFrom(input.priceFrom, { hideZero: true }) || undefined
        : undefined;
    case "RANGE":
      return formatPriceRange(input.priceFrom, input.priceTo, { hideZero: true }) || undefined;
    case "NONE":
      return undefined;
    case "UNKNOWN":
    case null:
    case undefined:
      return formatLegacyStoryPrice(input.priceText)
        ?? (input.priceFrom != null
          ? formatPrice(input.priceFrom, { hideZero: true }) || undefined
          : undefined);
  }
}
