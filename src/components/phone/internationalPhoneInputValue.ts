import type { E164Number } from "libphonenumber-js/core";

import { normalizePhoneToE164 } from "@/lib/phone/e164";

/**
 * Safely converts a stored `value` (which may be a legacy, non-normalized
 * string such as `"+375 (25) 530-00-53"`) into whatever `react-phone-number-input`
 * accepts as its `value` prop. Never throws, never passes an unparseable
 * string through as if it were a valid `E164Number` — `undefined` (empty
 * display) is safer than handing the library a value it can't actually
 * represent. This only affects what's rendered; it never calls `onChange`
 * itself, so opening a form with a legacy value never mutates anything.
 */
export function normalizeInternationalPhoneInputInitialValue(value: string): E164Number | undefined {
  const normalized = normalizePhoneToE164(value);
  return normalized ? (normalized as E164Number) : undefined;
}
