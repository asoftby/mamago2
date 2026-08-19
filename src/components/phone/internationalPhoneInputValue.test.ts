import assert from "node:assert/strict";

import { normalizeInternationalPhoneInputInitialValue } from "./internationalPhoneInputValue";

function testLegacyFormattedValueNormalizes() {
  assert.equal(normalizeInternationalPhoneInputInitialValue("+375 (25) 530-00-53"), "+375255300053");
}

function testAlreadyValidValuePassesThrough() {
  assert.equal(normalizeInternationalPhoneInputInitialValue("+375255300053"), "+375255300053");
}

function testEmptyValueIsUndefined() {
  assert.equal(normalizeInternationalPhoneInputInitialValue(""), undefined);
}

function testUnparseableValueIsUndefinedNotThrown() {
  // Must never throw when opening a form with a genuinely bad legacy value —
  // undefined (empty display) is the safe fallback, not a crash.
  assert.doesNotThrow(() => normalizeInternationalPhoneInputInitialValue("not a phone"));
  assert.equal(normalizeInternationalPhoneInputInitialValue("not a phone"), undefined);
}

function main() {
  testLegacyFormattedValueNormalizes();
  testAlreadyValidValuePassesThrough();
  testEmptyValueIsUndefined();
  testUnparseableValueIsUndefinedNotThrown();
  console.log("international phone input value tests: OK");
}

main();
