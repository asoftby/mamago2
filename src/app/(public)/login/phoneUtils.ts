/**
 * Belarus phone input utilities.
 * Single source of truth = raw digits (12 digits, starts with 375).
 *
 * DESIGN:
 * - rawPhone always starts with "375" (the country code is pre-seeded)
 * - user types only the operator code + number (9 digits after 375)
 * - normalizePhone strips non-digits and ensures the 375 prefix is stable
 * - isPhoneValid = exactly 12 digits
 */

/** The default/empty phone state — country code pre-seeded. */
export const PHONE_INITIAL = "375";

/**
 * Normalize any input into raw digits starting with 375, capped at 12.
 *
 * Rules:
 * - strip all non-digits
 * - if result is empty → return "375" (keep prefix)
 * - if result doesn't start with "375" → prepend "375"
 * - cap at 12 digits
 */
export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (!digits) return PHONE_INITIAL;

  // Already has correct prefix
  if (digits.startsWith("375")) {
    // Guard against double-prefix: user typed "375" into a field already showing "+375"
    // e.g. "375375447777405" → strip the duplicate → "375447777405"
    if (digits.startsWith("375375") && digits.length > 12) {
      return digits.slice(3, 15);
    }
    return digits.slice(0, 12);
  }

  // Old BY format "80X..." → strip leading "80", prepend 375
  if (digits.startsWith("80")) {
    return ("375" + digits.slice(2)).slice(0, 12);
  }

  // Local number or pasted without country code
  return ("375" + digits).slice(0, 12);
}

/**
 * Format raw digits into +375 XX XXX-XX-XX.
 * Handles partial input gracefully.
 */
export function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (!d) return "";

  const country = d.slice(0, 3); // "375"
  const op = d.slice(3, 5);      // operator code (2 digits)
  const p1 = d.slice(5, 8);      // XXX
  const p2 = d.slice(8, 10);     // XX
  const p3 = d.slice(10, 12);    // XX

  let result = "+" + country;
  if (op) result += " " + op;
  if (p1) result += " " + p1;
  if (p2) result += "-" + p2;
  if (p3) result += "-" + p3;

  return result;
}

/** A phone is valid when it has exactly 12 digits (375 + 9 operator+number digits). */
export function isPhoneValid(digits: string): boolean {
  return digits.length === 12 && digits.startsWith("375");
}
