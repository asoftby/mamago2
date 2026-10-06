/**
 * Family Core M3a: consent shown before joining a family (ConsentRecord FAMILY_SHARED_DATA).
 *
 * The legal text and its version are written by the product owner (law № 99-З)
 * and are NOT invented here. While `FAMILY_CONSENT_TEXT_VERSION` is empty the
 * join flow is closed: the page says "unavailable" and the API refuses to accept.
 *
 * To publish a new text: change the paragraphs AND bump the version; the version
 * is stored on every accepted ConsentRecord.
 */
export const FAMILY_CONSENT_TEXT_VERSION = "";

/** Paragraphs shown to the joiner. */
export const FAMILY_CONSENT_TEXT: readonly string[] = [];

export function familyConsentConfigured(
  version: string = FAMILY_CONSENT_TEXT_VERSION,
  text: readonly string[] = FAMILY_CONSENT_TEXT,
): boolean {
  return version.trim().length > 0 && text.length > 0 && text.every((p) => p.trim().length > 0);
}

/** The client must send exactly the version it was shown. */
export function consentVersionMatches(
  sent: string | null | undefined,
  version: string = FAMILY_CONSENT_TEXT_VERSION,
): boolean {
  return !!sent && sent.trim() === version.trim() && version.trim().length > 0;
}
