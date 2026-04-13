/**
 * Shared price formatter for the entire mamaGo platform.
 *
 * RULE: All prices must be displayed only through this formatter.
 * Direct string interpolation of currency is forbidden.
 *
 * Format: `{amount} BYN`
 * - Integer amounts: `100 BYN`
 * - Fractional amounts: `49.90 BYN`
 */

const CURRENCY = "BYN";

/**
 * Formats a numeric price value to the standard display format.
 *
 * @example
 * formatPrice(100)    // "100 BYN"
 * formatPrice(49.9)   // "49.90 BYN"
 * formatPrice(0)      // "0 BYN"
 */
export function formatPrice(amount: number): string {
  const isInteger = Number.isInteger(amount);
  const formatted = isInteger ? String(amount) : amount.toFixed(2);
  return `${formatted} ${CURRENCY}`;
}

/**
 * Formats a price with "от" prefix (used for "from X BYN" display).
 *
 * @example
 * formatPriceFrom(100)  // "от 100 BYN"
 * formatPriceFrom(49.9) // "от 49.90 BYN"
 */
export function formatPriceFrom(amount: number): string {
  return `от ${formatPrice(amount)}`;
}

/**
 * Formats a signed transaction amount (positive = income, negative = expense).
 * Includes sign prefix and absolute value.
 *
 * @example
 * formatTransactionAmount(100)   // "+100 BYN"
 * formatTransactionAmount(-49.9) // "−49.90 BYN"
 */
export function formatTransactionAmount(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount > 0 ? "+" : "−";
  return `${sign}${formatPrice(abs)}`;
}
