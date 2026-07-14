import assert from "node:assert/strict";

import { isValidE164Phone, normalizePhoneToE164, resolvePhoneInputToE164 } from "./e164";

function testLegacyFormattedBelarusianPhone() {
  // The exact value already confirmed sitting in target Place 437 pre-fix.
  assert.equal(normalizePhoneToE164("+375 (25) 530-00-53"), "+375255300053");
}

function testAlreadyValidE164() {
  assert.equal(normalizePhoneToE164("+375255300053"), "+375255300053");
}

function testBelarusianWithoutPlus() {
  assert.equal(normalizePhoneToE164("375255300053"), "+375255300053");
}

function testBelarusianViaEightZero() {
  // Legacy national "8 0XX..." trunk-prefix format.
  assert.equal(normalizePhoneToE164("80255300053"), "+375255300053");
}

function testSpacesParensDashesVariants() {
  assert.equal(normalizePhoneToE164("+375 (29) 341-55-66"), "+375293415566");
  assert.equal(normalizePhoneToE164("  +375 29 1-593-593  "), "+375291593593");
}

function testValidForeignE164() {
  assert.equal(normalizePhoneToE164("+1 650 253 0000"), "+16502530000");
}

function testEmptyAndWhitespace() {
  assert.equal(normalizePhoneToE164(""), "");
  assert.equal(normalizePhoneToE164("   "), "");
}

function testGarbageLetters() {
  assert.equal(normalizePhoneToE164("not a phone at all"), "");
}

function testTooShortNumber() {
  assert.equal(normalizePhoneToE164("12345"), "");
}

function testAmbiguousNumber() {
  // Right shape for a truncated BY mobile number but not a real prefix/length match —
  // never guessed into a "looks plausible" E.164 string.
  assert.equal(normalizePhoneToE164("+375291"), "");
}

function testInvalidInputNeverPassedThroughVerbatim() {
  // The old behaviour (`byPre || trimmed`) would have returned the raw
  // unparseable text here; the canonical helper must never do that.
  const result = normalizePhoneToE164("garbage-that-looks-like-+375-but-isnt");
  assert.notEqual(result, "garbage-that-looks-like-+375-but-isnt");
  assert.equal(result, "");
}

function testResolvePhoneInputToE164() {
  assert.equal(resolvePhoneInputToE164("+375 (25) 530-00-53", "BY"), "+375255300053");
  assert.equal(resolvePhoneInputToE164("", "BY"), null);
  assert.equal(resolvePhoneInputToE164("not a phone", "BY"), null);
}

function testIsValidE164Phone() {
  assert.equal(isValidE164Phone("+375255300053"), true);
  assert.equal(isValidE164Phone(""), false);
  assert.equal(isValidE164Phone("+375 (25) 530-00-53"), true, "isValidE164Phone normalizes before validating");
  assert.equal(isValidE164Phone("not a phone"), false);
}

function main() {
  testLegacyFormattedBelarusianPhone();
  testAlreadyValidE164();
  testBelarusianWithoutPlus();
  testBelarusianViaEightZero();
  testSpacesParensDashesVariants();
  testValidForeignE164();
  testEmptyAndWhitespace();
  testGarbageLetters();
  testTooShortNumber();
  testAmbiguousNumber();
  testInvalidInputNeverPassedThroughVerbatim();
  testResolvePhoneInputToE164();
  testIsValidE164Phone();
  console.log("e164 tests: OK");
}

main();
