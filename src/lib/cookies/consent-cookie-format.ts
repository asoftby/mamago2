/**
 * Format of the `cc_cookie_mamago` cookie written by `vanilla-cookieconsent`
 * (v3.0.1) — reverse-engineered from `dist/cookieconsent.esm.js`'s own
 * cookie-write (`ke`) and cookie-read/validity (`Xe`'s internal `D` /
 * `validConsent`) logic, not guessed. Kept isomorphic (no DOM/server-only
 * APIs) so it can run both in a server component and in the pre-hydration
 * inline script (see `src/app/layout.tsx`) that decides whether the initial
 * cookie-consent shell should stay visible for a returning, already-consented
 * visitor.
 *
 * The cookie value is `encodeURIComponent(JSON.stringify(consentRecord))`,
 * where `consentRecord` includes (among other fields) `consentId`,
 * `revision`, `categories`, `consentTimestamp` and `lastConsentTimestamp`.
 * The library treats consent as "still needs collecting" unless all of
 * these are present *and* the stored `revision` matches the configured one
 * — see `hasValidConsentCookieValue` below, which mirrors that check.
 */

/** Must match `cookie.name` in `createCookieConsentRunConfig` (consent-config.ts). */
export const CONSENT_COOKIE_NAME = "cc_cookie_mamago";

/**
 * Must match `revision` in `createCookieConsentRunConfig` (consent-config.ts).
 * Duplicated (not imported) because `externalAnalyticsContract.test.ts`
 * pins `revision: <number literal>` directly in consent-config.ts; the two
 * are kept in sync by `consent-cookie-format.test.ts`, not by a shared
 * import, so that existing contract test's literal-number assertion still
 * holds unmodified.
 */
export const CONSENT_REVISION = 1;

type RawConsentCookie = {
  consentId?: unknown;
  revision?: unknown;
  categories?: unknown;
  consentTimestamp?: unknown;
  lastConsentTimestamp?: unknown;
};

/**
 * True only if `raw` (the *decoded* cookie value, before URI-decoding) is a
 * `vanilla-cookieconsent` record for the currently configured revision with
 * all the fields the library itself requires to consider consent valid
 * (`validConsent()` / internal `!o.D`). Never throws; any parse/shape
 * problem is treated as "not valid" (fail-closed toward *showing* the
 * consent UI again, never toward hiding it).
 */
export function hasValidConsentCookieValue(raw: string | undefined | null): boolean {
  if (!raw) return false;
  try {
    const decoded = decodeURIComponent(raw);
    const data = JSON.parse(decoded) as RawConsentCookie;
    if (typeof data !== "object" || data === null) return false;
    return (
      typeof data.consentId === "string" &&
      data.consentId.length > 0 &&
      data.revision === CONSENT_REVISION &&
      Array.isArray(data.categories) &&
      Boolean(data.consentTimestamp) &&
      Boolean(data.lastConsentTimestamp)
    );
  } catch {
    return false;
  }
}

/**
 * Convenience wrapper: extracts `cc_cookie_mamago` out of a raw
 * `document.cookie`-style string (`"a=1; cc_cookie_mamago=...; b=2"`) and
 * validates it. Used by tests and any future server-side reader; the
 * pre-hydration inline script re-implements this same lookup+parse in plain
 * JS (it cannot import a TS module) — see `NO_FLASH_COOKIE_CONSENT_SCRIPT`.
 */
export function hasValidConsentCookieInHeader(cookieHeader: string | undefined | null): boolean {
  if (!cookieHeader) return false;
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE_NAME}=([^;]*)`),
  );
  if (!match) return false;
  return hasValidConsentCookieValue(match[1]);
}
