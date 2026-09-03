import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CONSENT_COOKIE_NAME,
  CONSENT_REVISION,
  hasValidConsentCookieInHeader,
  hasValidConsentCookieValue,
} from "./consent-cookie-format";

function validRecord(overrides: Record<string, unknown> = {}) {
  return {
    categories: ["necessary", "analytics"],
    revision: CONSENT_REVISION,
    data: null,
    consentTimestamp: "2026-09-01T00:00:00.000Z",
    consentId: "11111111-1111-4111-8111-111111111111",
    services: { analytics: ["ga4"], marketing: [] },
    lastConsentTimestamp: "2026-09-01T00:00:00.000Z",
    expirationTime: 4102444800000,
    ...overrides,
  };
}

function encodeCookieValue(record: unknown): string {
  return encodeURIComponent(JSON.stringify(record));
}

// --- 1. real vanilla-cookieconsent shaped cookie -> valid ---
{
  const value = encodeCookieValue(validRecord());
  assert.equal(hasValidConsentCookieValue(value), true);
}

// --- 2. missing / empty / undefined -> invalid, no throw ---
{
  assert.equal(hasValidConsentCookieValue(undefined), false);
  assert.equal(hasValidConsentCookieValue(null), false);
  assert.equal(hasValidConsentCookieValue(""), false);
}

// --- 3. malformed JSON -> invalid, no throw ---
{
  assert.equal(hasValidConsentCookieValue("not%20json%20at%20all"), false);
  assert.equal(hasValidConsentCookieValue(encodeURIComponent("{broken")), false);
}

// --- 4. wrong revision (stale, from before a provider-set change) -> invalid ---
{
  const value = encodeCookieValue(validRecord({ revision: CONSENT_REVISION - 1 }));
  assert.equal(hasValidConsentCookieValue(value), false);
}

// --- 5. missing consentId / not a string / empty -> invalid ---
{
  assert.equal(hasValidConsentCookieValue(encodeCookieValue(validRecord({ consentId: undefined }))), false);
  assert.equal(hasValidConsentCookieValue(encodeCookieValue(validRecord({ consentId: "" }))), false);
  assert.equal(hasValidConsentCookieValue(encodeCookieValue(validRecord({ consentId: 42 }))), false);
}

// --- 6. categories not an array -> invalid ---
{
  assert.equal(
    hasValidConsentCookieValue(encodeCookieValue(validRecord({ categories: "all" }))),
    false,
  );
}

// --- 7. missing timestamps -> invalid (still "needs consent" per the library's own semantics) ---
{
  assert.equal(
    hasValidConsentCookieValue(encodeCookieValue(validRecord({ consentTimestamp: undefined }))),
    false,
  );
  assert.equal(
    hasValidConsentCookieValue(encodeCookieValue(validRecord({ lastConsentTimestamp: undefined }))),
    false,
  );
}

// --- 8. hasValidConsentCookieInHeader extracts from a realistic document.cookie string ---
{
  const value = encodeCookieValue(validRecord());
  const header = `mamago_session=abc; ${CONSENT_COOKIE_NAME}=${value}; other=1`;
  assert.equal(hasValidConsentCookieInHeader(header), true);
  assert.equal(hasValidConsentCookieInHeader("mamago_session=abc; other=1"), false);
  assert.equal(hasValidConsentCookieInHeader(undefined), false);
}

// --- 9. the pre-hydration inline script (no-flash-cookie-shell-script.ts) must reference the
//        SAME cookie name / revision constants, not a second, potentially-drifted literal.
{
  const scriptSource = readFileSync(
    new URL("./no-flash-cookie-shell-script.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    scriptSource,
    /\$\{CONSENT_COOKIE_NAME\}=/,
    "inline script must interpolate CONSENT_COOKIE_NAME, not a hardcoded cookie name",
  );
  assert.match(
    scriptSource,
    /d\.revision===\$\{CONSENT_REVISION\}/,
    "inline script must interpolate CONSENT_REVISION, not a hardcoded revision number",
  );
  assert.match(scriptSource, /d\.consentId/);
  assert.match(scriptSource, /Array\.isArray\(d\.categories\)/);
  assert.match(scriptSource, /d\.consentTimestamp/);
  assert.match(scriptSource, /d\.lastConsentTimestamp/);
}

// --- 10. consent-config.ts's `revision:` literal must match CONSENT_REVISION exactly
//         (kept as a duplicated literal, not a shared import — see that file's comment
//         and externalAnalyticsContract.test.ts, which pins the literal-number shape). ---
{
  const configSource = readFileSync(
    new URL("./consent-config.ts", import.meta.url),
    "utf8",
  );
  const match = configSource.match(/revision:\s*(\d+)/);
  assert.ok(match, "consent-config.ts must set a literal numeric revision");
  assert.equal(Number(match![1]), CONSENT_REVISION);

  const cookieNameMatch = configSource.match(/name:\s*CONSENT_COOKIE_NAME/);
  assert.ok(
    cookieNameMatch,
    "consent-config.ts must source cookie.name from CONSENT_COOKIE_NAME, not a second literal",
  );
}

console.log("consent-cookie-format tests: OK");
