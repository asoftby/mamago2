import {
  BYN_SYMBOL,
  formatPrice,
  formatPriceAmount,
  normalizeUiCurrencyText,
} from "@/lib/formatters/format-price";

type ActivityPriceLike = {
  priceText?: string | null;
  priceFrom?: number | null;
};

function priceTextWithCurrencyIfNeeded(text: string): string {
  if (/\bbyn\b/i.test(text) || /\bbr\b/i.test(text) || /руб\.?/i.test(text) || text.includes(BYN_SYMBOL)) {
    return normalizeUiCurrencyText(text);
  }
  const lower = text.toLowerCase();
  if (
    lower.includes("бесплатно") ||
    lower.includes("уточняйте") ||
    /€|\$|£|₽/.test(text)
  ) {
    return text;
  }
  const numStr = formatPriceAmount(text);
  if (numStr) return `${numStr} ${BYN_SYMBOL}`;
  return `${text} ${BYN_SYMBOL}`;
}

export function formatPlanActivityPriceLabel(
  activity: ActivityPriceLike | null | undefined,
): string | null {
  if (!activity) return null;
  const text = activity.priceText?.trim();
  if (text) {
    const formatted = priceTextWithCurrencyIfNeeded(text);
    return formatted || null;
  }
  if (activity.priceFrom === 0) return "Бесплатно";
  if (activity.priceFrom != null) {
    const formatted = formatPrice(activity.priceFrom);
    return formatted || null;
  }
  return null;
}
