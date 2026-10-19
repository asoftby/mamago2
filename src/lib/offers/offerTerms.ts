/**
 * Предоплата и отмена чипами (TZ-1 §5). В модели остаются текстовые поля, новых enum нет:
 * чип пишет стандартную строку, а нераспознанный прежний текст показывается как «Своё: …»
 * и не подменяется стандартной строкой, пока партнёр сам не выберет чип.
 */

export interface OfferTermChip {
  id: string;
  label: string;
  /** Строка, которая сохраняется в `Offer.prepaymentTerms` / `Offer.cancellationTerms`. */
  value: string;
}

export const PREPAYMENT_CHIPS: readonly OfferTermChip[] = [
  { id: "none", label: "Без предоплаты", value: "Без предоплаты" },
  { id: "30", label: "30%", value: "Предоплата 30%" },
  { id: "50", label: "50%", value: "Предоплата 50%" },
  { id: "100", label: "100%", value: "Предоплата 100%" },
];

export const CANCELLATION_CHIPS: readonly OfferTermChip[] = [
  { id: "24h", label: "Бесплатно за 24 ч", value: "Бесплатная отмена за 24 часа" },
  { id: "48h", label: "Бесплатно за 48 ч", value: "Бесплатная отмена за 48 часов" },
  { id: "7d", label: "Бесплатно за 7 дней", value: "Бесплатная отмена за 7 дней" },
  { id: "nr", label: "Без возврата", value: "Без возврата" },
];

export const CUSTOM_TERMS_PREFIX = "Своё: ";

export type OfferTermSelection =
  | { kind: "empty" }
  | { kind: "chip"; id: string }
  | { kind: "custom"; text: string };

const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

/** Какой чип соответствует сохранённому тексту. Всё остальное — «своё». */
export function matchOfferTerm(chips: readonly OfferTermChip[], stored: string | null | undefined): OfferTermSelection {
  const text = (stored ?? "").trim();
  if (!text) return { kind: "empty" };
  const exact = chips.find((chip) => normalize(chip.value) === normalize(text));
  if (exact) return { kind: "chip", id: exact.id };
  const custom = text.startsWith(CUSTOM_TERMS_PREFIX) ? text.slice(CUSTOM_TERMS_PREFIX.length) : text;
  return { kind: "custom", text: custom.trim() };
}

/** Своё значение для хранения: с префиксом «Своё: » ровно один раз; пустой текст → пустая строка. */
export function formatCustomOfferTerm(text: string): string {
  const clean = text.trim();
  if (!clean) return "";
  return clean.startsWith(CUSTOM_TERMS_PREFIX) ? clean : `${CUSTOM_TERMS_PREFIX}${clean}`;
}

/** Блок «Предоплата и отмена» не нужен, когда записи нет вовсе. */
export function offerShowsPaymentTerms(bookingMethod: string | null | undefined): boolean {
  return bookingMethod !== "NONE";
}

/** Значение формы → колонка: пустое — `null`. */
export function termsColumnValue(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return text ? text : null;
}

/** Колонка Offer важнее прежнего значения из `details` (party), которое остаётся как есть. */
export function pickTermsValue(column: string | null | undefined, legacyDetails: unknown): string {
  if (typeof column === "string" && column.trim()) return column;
  return typeof legacyDetails === "string" ? legacyDetails : "";
}

export const SERVICE_AREA_MAX_LENGTH = 200;
