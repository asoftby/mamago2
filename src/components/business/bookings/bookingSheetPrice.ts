/**
 * Цена в шапке окна заявки. Структурированная цена (priceFrom) идёт в билет-карточку,
 * свободный текст цены показывается как есть: адаптер билета берёт первое число
 * и исказил бы строки вроде «детям 3-5 лет — 20 BYN».
 */
export type BookingSheetPrice = {
  ticket: { priceMode: "FROM" | "UNKNOWN"; priceValue: number | null; priceLabel: null };
  freeText: string | null;
};

export function resolveBookingSheetPrice(priceFrom: number | null, priceText: string | null): BookingSheetPrice {
  if (priceFrom != null && Number.isFinite(priceFrom) && priceFrom > 0) {
    return { ticket: { priceMode: "FROM", priceValue: priceFrom, priceLabel: null }, freeText: null };
  }
  const text = priceText?.trim() || null;
  return { ticket: { priceMode: "UNKNOWN", priceValue: null, priceLabel: null }, freeText: text };
}
