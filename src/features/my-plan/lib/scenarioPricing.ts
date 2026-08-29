export type ScenarioPriceSource = {
  priceFrom: number | null;
  priceTo: number | null;
  currency: string | null;
  priceText: string | null;
};

/**
 * Compact price label for a Scenario card ("40 BYN", "от 40 BYN",
 * "Бесплатно"). Prefers structured `priceFrom`/`priceTo`; falls back to the
 * free-text `priceText` an owner may have entered instead; returns null
 * when there is genuinely nothing to show (never fabricates a price).
 */
export function formatScenarioPriceLabel(source: ScenarioPriceSource | null | undefined): string | null {
  if (!source) return null;
  const { priceFrom, priceTo, currency, priceText } = source;

  if (priceFrom === 0 && (priceTo == null || priceTo === 0)) return "Бесплатно";

  if (priceFrom != null) {
    const cur = currency || "BYN";
    if (priceTo != null && priceTo !== priceFrom) return `от ${priceFrom} ${cur}`;
    return `${priceFrom} ${cur}`;
  }

  const text = priceText?.trim();
  return text ? text : null;
}
