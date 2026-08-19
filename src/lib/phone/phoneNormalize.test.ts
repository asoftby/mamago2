import assert from "node:assert/strict";

import { normalizePhoneToE164 as canonical } from "./e164";
import { normalizePhoneToE164 as reExported } from "./phoneNormalize";

function testReExportIsTheSameFunctionAsCanonical() {
  // Strict reference equality — not just "same behavior today" but
  // structurally guaranteed to never diverge again, since it's literally
  // the same function object, not a second implementation.
  assert.equal(reExported, canonical);
}

function testReExportedBehaviorMatchesCanonicalOnKnownCases() {
  assert.equal(reExported("+375 (25) 530-00-53"), "+375255300053");
  assert.equal(reExported(""), "");
  assert.equal(reExported("not a phone"), "");
}

function main() {
  testReExportIsTheSameFunctionAsCanonical();
  testReExportedBehaviorMatchesCanonicalOnKnownCases();
  console.log("phoneNormalize tests: OK");
}

main();
