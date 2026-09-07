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

assert.equal(hasValidConsentCookieValue(encodeCookieValue(validRecord())), true);
assert.equal(hasValidConsentCookieValue(undefined), false);
assert.equal(hasValidConsentCookieValue(null), false);
assert.equal(hasValidConsentCookieValue(""), false);
assert.equal(hasValidConsentCookieValue("not%20json%20at%20all"), false);
assert.equal(
  hasValidConsentCookieValue(encodeCookieValue(validRecord({ revision: CONSENT_REVISION - 1 }))),
  false,
);
assert.equal(
  hasValidConsentCookieValue(encodeCookieValue(validRecord({ consentId: undefined }))),
  false,
);
assert.equal(
  hasValidConsentCookieValue(encodeCookieValue(validRecord({ categories: "all" }))),
  false,
);
assert.equal(
  hasValidConsentCookieValue(encodeCookieValue(validRecord({ consentTimestamp: undefined }))),
  false,
);

const value = encodeCookieValue(validRecord());
const header = `mamago_session=abc; ${CONSENT_COOKIE_NAME}=${value}; other=1`;
assert.equal(hasValidConsentCookieInHeader(header), true);
assert.equal(hasValidConsentCookieInHeader("mamago_session=abc; other=1"), false);

const scriptSource = readFileSync(
  new URL("./no-flash-cookie-shell-script.ts", import.meta.url),
  "utf8",
);
assert.match(scriptSource, /\$\{CONSENT_COOKIE_NAME\}=/);
assert.match(scriptSource, /d\.revision===\$\{CONSENT_REVISION\}/);
assert.match(scriptSource, /d\.consentId/);
assert.match(scriptSource, /Array\.isArray\(d\.categories\)/);
assert.match(scriptSource, /d\.consentTimestamp/);
assert.match(scriptSource, /d\.lastConsentTimestamp/);

const configSource = readFileSync(new URL("./consent-config.ts", import.meta.url), "utf8");
const revisionMatch = configSource.match(/revision:\s*(\d+)/);
assert.ok(revisionMatch);
assert.equal(Number(revisionMatch![1]), CONSENT_REVISION);
assert.match(configSource, /name:\s*CONSENT_COOKIE_NAME/);

console.log("consent-cookie-format tests: OK");
