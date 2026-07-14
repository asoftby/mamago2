/**
 * Was a second, naive regex-based `normalizePhoneToE164` implementation
 * that disagreed with `src/lib/phone/e164.ts`'s libphonenumber-based one
 * (e.g. it never rejected invalid input — always returned some "+"-prefixed
 * digit string, even for garbage). Re-exported instead of duplicated so
 * there is exactly one canonical implementation project-wide.
 */
export { normalizePhoneToE164 } from "./e164";
