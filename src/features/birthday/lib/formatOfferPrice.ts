import type { BirthdayOffer } from "../types/birthday";

/** Одна конкретная цена или диапазон — без лишнего «от», если цена фиксирована */
export function formatConcreteOfferPrice(offer: BirthdayOffer): string | null {
  if (offer.priceFrom == null) return null;
  const from = offer.priceFrom;
  const to = offer.priceTo;
  if (to != null && to > from) {
    return `${from}–${to} ${offer.currency}`;
  }
  return `${from} ${offer.currency}`;
}
