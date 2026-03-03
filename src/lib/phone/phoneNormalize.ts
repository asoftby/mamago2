/**
 * Phone normalization utilities
 * Converts various phone formats to E.164 standard
 */

/**
 * Normalize phone number to E.164 format
 * @param input - Raw phone input (can include spaces, brackets, dashes, etc.)
 * @returns E.164 formatted phone (e.g., "+375291234567")
 */
export function normalizePhoneToE164(input: string): string {
  // Strip all non-digits
  const digits = input.replace(/\D/g, "");

  // If starts with 375, prepend +
  if (digits.startsWith("375")) {
    return "+" + digits;
  }

  // If starts with 80 and has at least 11 digits, convert to 375
  // Example: 80291234567 -> +375291234567
  if (digits.startsWith("80") && digits.length >= 11) {
    return "+375" + digits.slice(2);
  }

  // If starts with mobile prefix (25/29/33/44) and has 9 digits, prepend 375
  // Example: 291234567 -> +375291234567
  if (/^(25|29|33|44)/.test(digits) && digits.length === 9) {
    return "+375" + digits;
  }

  // If input already starts with +, keep it and append digits
  if (input.trim().startsWith("+")) {
    return "+" + digits;
  }

  // Default: prepend + to digits
  return "+" + digits;
}
