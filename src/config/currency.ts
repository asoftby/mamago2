import {
  BELARUSIAN_RUBLE_CODE,
  BELARUSIAN_RUBLE_NAME,
  BELARUSIAN_RUBLE_SYMBOL,
} from "@/lib/currency";

/**
 * System currency configuration for mamaGo.
 *
 * RULES:
 * — One currency for the whole platform (BYN — Belarusian ruble).
 * — This config is NOT managed via admin UI. It is a project-level constant.
 * — Prices are stored and entered as plain numbers (no currency string in DB/forms).
 * — The canonical BYN symbol token is shared from `src/lib/currency.ts`.
 * — Rich/public UI may render that token via <BelarusianRubleIcon />.
 * — Never hard-code "BYN", "Br", "руб.", "₽" in JSX price output.
 */
export const DEFAULT_CURRENCY = {
  /** ISO 4217 currency code — use only in technical/API/schema contexts. */
  code: BELARUSIAN_RUBLE_CODE,
  name: BELARUSIAN_RUBLE_NAME,
  /** Canonical BYN glyph from the NBRB font. */
  symbol: BELARUSIAN_RUBLE_SYMBOL,
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
