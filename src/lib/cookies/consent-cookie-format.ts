/** Shared format contract for the vanilla-cookieconsent cookie. */
export const CONSENT_COOKIE_NAME = "cc_cookie_mamago";
export const CONSENT_REVISION = 1;

type RawConsentCookie = {
  consentId?: unknown;
  revision?: unknown;
  categories?: unknown;
  consentTimestamp?: unknown;
  lastConsentTimestamp?: unknown;
};

export function hasValidConsentCookieValue(
  raw: string | undefined | null,
): boolean {
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

export function hasValidConsentCookieInHeader(
  cookieHeader: string | undefined | null,
): boolean {
  if (!cookieHeader) return false;
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE_NAME}=([^;]*)`),
  );
  if (!match) return false;
  return hasValidConsentCookieValue(match[1]);
}
