/**
 * Shared UI price formatter for the entire mamaGo platform.
 *
 * RULE: user-facing prices must be displayed only through this formatter layer.
 * Technical currency codes like `BYN` may still exist in DB/API/schema contexts.
 */
import { DEFAULT_CURRENCY } from "@/config/currency";

export const BELARUS_CURRENCY_SYMBOL = DEFAULT_CURRENCY.symbol;
export const BYN_SYMBOL = BELARUS_CURRENCY_SYMBOL;

type FormatPriceOptions = {
  freeLabel?: string;
  fromPrefix?: boolean;
  currencySymbol?: string;
  hideZero?: boolean;
};

const UI_CURRENCY_RE = /\bBYN\b|\bBr\b|руб\.?|р\.|₽/gi;

function formatNumber(value: number): string {
  // Always 2 decimal places: 15 → "15,00", 15.5 → "15,50"
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseNumberish(value: string): number | null {
  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeUiCurrencyText(
  value: string | null | undefined,
  currencySymbol: string = BELARUS_CURRENCY_SYMBOL,
): string {
  if (!value) return "";
  return value
    .replace(UI_CURRENCY_RE, currencySymbol)
    .replace(/\s{2,}/g, " ")
    .replace(new RegExp(`${currencySymbol}\\s*${currencySymbol}`, "g"), currencySymbol)
    .trim();
}

/** Число и хвост (символ BYN + единица), без разрыва по пробелу внутри суммы. */
export function splitUiPriceLabel(value: string | null | undefined): {
  amount: string;
  suffix: string;
} {
  const normalized = normalizeUiCurrencyText(value);
  if (!normalized) return { amount: "", suffix: "" };

  const symbolIdx = normalized.indexOf(BYN_SYMBOL);
  if (symbolIdx !== -1) {
    return {
      amount: normalized.slice(0, symbolIdx).trim(),
      suffix: normalized.slice(symbolIdx).trim(),
    };
  }

  const spaceIdx = normalized.lastIndexOf(" ");
  if (spaceIdx === -1) return { amount: normalized, suffix: "" };
  return {
    amount: normalized.slice(0, spaceIdx).trim(),
    suffix: normalized.slice(spaceIdx + 1).trim(),
  };
}

export function formatPrice(
  value: number | string | null | undefined,
  options: FormatPriceOptions = {},
): string {
  if (value == null) return "";

  const currencySymbol = options.currencySymbol ?? BELARUS_CURRENCY_SYMBOL;
  const freeLabel = options.freeLabel ?? "Бесплатно";

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const parsed = parseNumberish(trimmed);
    if (parsed == null) return normalizeUiCurrencyText(trimmed, currencySymbol);
    return formatPrice(parsed, options);
  }

  if (!Number.isFinite(value)) return "";
  if (value === 0 && !options.hideZero) return freeLabel;

  const formatted = `${formatNumber(value)} ${currencySymbol}`;
  return options.fromPrefix ? `от ${formatted}` : formatted;
}

export const formatMoney = formatPrice;

export function formatPriceFrom(
  value: number | string | null | undefined,
  options: Omit<FormatPriceOptions, "fromPrefix"> = {},
): string {
  return formatPrice(value, { ...options, fromPrefix: true });
}

export function formatPriceUpTo(
  value: number | string | null | undefined,
  options: Omit<FormatPriceOptions, "fromPrefix"> = {},
): string {
  const base = formatPrice(value, { ...options, hideZero: true });
  return base ? `до ${base}` : "";
}

export function formatPriceRange(
  from: number | string | null | undefined,
  to: number | string | null | undefined,
  options: Omit<FormatPriceOptions, "fromPrefix"> = {},
): string {
  const currencySymbol = options.currencySymbol ?? BELARUS_CURRENCY_SYMBOL;
  const fromNum = typeof from === "string" ? parseNumberish(from) : from;
  const toNum = typeof to === "string" ? parseNumberish(to) : to;

  if (fromNum == null && toNum == null) return "";
  if (fromNum == null) return formatPriceUpTo(toNum, options);
  if (toNum == null) return formatPriceFrom(fromNum, options);
  if (fromNum === toNum) return formatPrice(fromNum, { ...options, hideZero: true });
  return `${formatNumber(fromNum)}–${formatNumber(toNum)} ${currencySymbol}`;
}

export function formatTransactionAmount(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount > 0 ? "+" : "−";
  return `${sign}${formatPrice(abs, { hideZero: true })}`;
}

/**
 * Returns only the formatted number string (no currency symbol, no prefix).
 * Use with {@link BelarusianRubleIcon} to compose price display independently.
 *
 * @example
 *   formatPriceAmount(15)      // "15,00"
 *   formatPriceAmount(15.5)    // "15,50"
 *   formatPriceAmount("25.4")  // "25,40"
 *   formatPriceAmount(null)    // ""
 */
export function formatPriceAmount(
  value: number | string | null | undefined,
): string {
  if (value == null) return "";
  if (typeof value === "string") {
    const parsed = parseNumberish(value.trim());
    return parsed != null ? formatNumber(parsed) : "";
  }
  if (!Number.isFinite(value)) return "";
  return formatNumber(value);
}

export const formatMoneyAmount = formatPriceAmount;
