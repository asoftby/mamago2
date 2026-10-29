import type { OfferPageData } from "@/lib/offer/offerPageTypes";
import { normalizeUiCurrencyText } from "@/lib/formatters/format-price";

export function publicOfferPriceLabel(
  pricing: OfferPageData["pricing"],
  label: string,
): string {
  if (pricing.priceMode === "FREE") return "Бесплатно";
  if (pricing.priceMode === "ON_REQUEST") return "Цена по запросу";
  if (pricing.priceMode === "NONE") return "";
  const text = normalizeUiCurrencyText(label);
  return (pricing.priceMode === "FROM" || pricing.priceMode === "RANGE") && text && !/^от\s/i.test(text)
    ? `от ${text}`
    : text;
}
