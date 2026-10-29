/**
 * Deterministic BYN-only price snapshot. All amounts and option metadata come
 * from server-side OfferBooking / OfferClassTariff records; callers pass IDs only.
 * Amounts are integer kopeks to avoid floating-point currency arithmetic.
 * Nothing here charges a customer or promises an estimated quote as a fixed fee.
 */
export type BookingPricedOption = {
  id: string;
  title: string;
  mode: "INCLUDED" | "OPTIONAL" | "STANDALONE";
  priceByn: string;
  bookingUnitId: string | null;
  active: boolean;
};
export class BookingPriceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingPriceError";
  }
}

export type BookingPriceSnapshot = {
  version: 1;
  currency: "BYN";
  status: "FIXED" | "QUOTE_REQUIRED";
  basis: "CLASS_TARIFF" | "OFFER_BASE" | "UNPRICED";
  seats: number;
  durationMinutes: number;
  base: {
    tariffId: string | null; title: string | null;
    amountByn: string | null; unit: string | null;
  };
  options: Array<{
    id: string; title: string; mode: "INCLUDED" | "OPTIONAL";
    amountByn: string; bookingUnitId: string | null;
  }>;
  totalByn: string | null;
};

export function kopeks(raw: string): number | null {
  const text = raw.trim().replace(",", ".").replace(/\s*(?:BYN|руб\.?|р\.)\s*$/i, "");
  if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, cents = ""] = text.split(".");
  const value = Number(whole) * 100 + Number(cents.padEnd(2, "0"));
  return Number.isSafeInteger(value) && value <= 999_999_999 ? value : null;
}
const money = (value: number) =>
  `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;

export function calculateBookingPrice(input: {
  currency: string;
  seats: number;
  durationMinutes: number;
  basePriceByn: string | null;
  tariff: { id: string; title: string; price: string; unit: string } | null;
  options: readonly BookingPricedOption[];
  selectedOptionIds?: readonly string[];
}): { snapshot: BookingPriceSnapshot; optionUnitIds: string[] } {
  const selected = input.selectedOptionIds ?? [];
  if (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > 100 ||
      !Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 ||
      input.durationMinutes > 7 * 24 * 60 || selected.length > 20 ||
      selected.some(id => typeof id !== "string" || !id.trim() || id.length > 128) ||
      new Set(selected).size !== selected.length) {
    throw new BookingPriceError("Некорректный выбор допуслуг");
  }
  if (input.currency !== "BYN" && (selected.length > 0 || input.options.some(o => o.active && o.mode === "INCLUDED"))) {
    throw new BookingPriceError("Расчёт допуслуг доступен только в BYN");
  }
  const available = new Map(input.options.filter(o => o.active).map(o => [o.id, o]));
  if (available.size !== input.options.filter(o => o.active).length) {
    throw new BookingPriceError("Повторяющиеся идентификаторы допуслуг");
  }
  for (const id of selected) {
    const item = available.get(id);
    if (!item || item.mode !== "OPTIONAL") {
      throw new BookingPriceError("Допуслуга недоступна для выбранного предложения");
    }
  }

  let basis: BookingPriceSnapshot["basis"] = "UNPRICED";
  let base: number | null = null;
  if (input.tariff) {
    basis = "CLASS_TARIFF";
    base = kopeks(input.tariff.price);
  } else if (input.basePriceByn !== null) {
    basis = "OFFER_BASE";
    base = kopeks(input.basePriceByn);
  }
  // An OfferClassTariff may be a multi-visit/monthly package, not a
  // per-person ticket. Do not multiply it by seats without a defined unit.
  // For multi-seat class bookings the total is a quote, not a fixed price.
  const exact = input.currency === "BYN" && base !== null &&
    !(basis === "CLASS_TARIFF" && input.seats > 1);
  const picked = input.options.filter(o => o.active &&
    (o.mode === "INCLUDED" || selected.includes(o.id)));
  const breakdown: BookingPriceSnapshot["options"] = [];
  const resources = new Set<string>();
  let addons = 0;
  for (const option of picked) {
    if (option.mode === "STANDALONE") {
      throw new BookingPriceError("Отдельная услуга оформляется через собственное предложение");
    }
    const amount = kopeks(option.priceByn);
    if (amount === null || (option.mode === "INCLUDED" && amount !== 0)) {
      throw new BookingPriceError("Цена допуслуги указана некорректно");
    }
    addons += amount;
    if (addons > 999_999_999) throw new BookingPriceError("Сумма допуслуг превышает лимит");
    if (option.bookingUnitId) resources.add(option.bookingUnitId);
    breakdown.push({
      id: option.id, title: option.title, mode: option.mode,
      amountByn: money(amount), bookingUnitId: option.bookingUnitId,
    });
  }
  const total = base === null ? null : base + addons;
  if (total !== null && total > 999_999_999) throw new BookingPriceError("Сумма заказа превышает лимит");
  const snapshot: BookingPriceSnapshot = {
    version: 1, currency: "BYN", status: exact ? "FIXED" : "QUOTE_REQUIRED",
    basis, seats: input.seats, durationMinutes: input.durationMinutes,
    base: {
      tariffId: input.tariff?.id ?? null,
      title: input.tariff?.title ?? null,
      amountByn: base === null ? null : money(base),
      unit: input.tariff?.unit ?? null,
    },
    options: breakdown,
    totalByn: exact && total !== null ? money(total) : null,
  };
  return { snapshot, optionUnitIds: [...resources].sort() };
}
