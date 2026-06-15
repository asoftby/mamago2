/**
 * System currency configuration for mamaGo.
 *
 * RULES:
 * — One currency for the whole platform (BYN — Belarusian ruble).
 * — This config is NOT managed via admin UI. It is a project-level constant.
 * — Prices are stored and entered as plain numbers (no currency string in DB/forms).
 * — The currency symbol is rendered in public UI exclusively via <BelarusianRubleIcon />.
 * — Never hard-code "BYN", "Br", "руб.", "₽" in JSX price output.
 */
export const DEFAULT_CURRENCY = {
  /** ISO 4217 currency code — use only in technical/API/schema contexts. */
  code: "BYN",
  name: "Белорусский рубль",
  /** Private-use glyph from the official NBRB font; UI should render it via shared helpers/icon. */
  symbol: "\uE901",
  /** Number of decimal places shown in UI. */
  fractionDigits: 2,
  /** Decimal separator for user-facing output. */
  decimalSeparator: ",",
  /** Symbol rendered after the numeric amount. */
  symbolPosition: "after",
} as const;

export type CurrencyConfig = typeof DEFAULT_CURRENCY;
export const CURRENCY = {
  BYN: DEFAULT_CURRENCY,
} as const;
