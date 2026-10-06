import assert from "node:assert/strict";
import { consentVersionMatches, familyConsentConfigured, FAMILY_CONSENT_TEXT, FAMILY_CONSENT_TEXT_VERSION } from "./familyConsent";

assert.equal(familyConsentConfigured("", []), false);
assert.equal(familyConsentConfigured("v1", []), false);
assert.equal(familyConsentConfigured("", ["text"]), false);
assert.equal(familyConsentConfigured("v1", [" "]), false);
assert.equal(familyConsentConfigured("v1", ["text"]), true);
assert.equal(consentVersionMatches("v1", "v1"), true);
assert.equal(consentVersionMatches(" v1 ", "v1"), true);
assert.equal(consentVersionMatches("v2", "v1"), false);
assert.equal(consentVersionMatches("", ""), false, "empty version never matches");
assert.equal(consentVersionMatches(undefined, "v1"), false);
// Repository invariant: either both text and version are filled in, or neither.
assert.equal(FAMILY_CONSENT_TEXT_VERSION.trim().length > 0, FAMILY_CONSENT_TEXT.length > 0, "text and version must be set together");
console.log("familyConsent.test: ok");
