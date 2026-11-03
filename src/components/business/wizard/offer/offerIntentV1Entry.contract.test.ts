import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/components/business/wizard/offer/OfferWizard.tsx", "utf8");

test("intent-led create opens a valid step for either wizard variant", () => {
  assert.match(source, /variant === "v2" \? "about" : "details"/);
  assert.match(source, /creationIntent === "classes" \|\| creationIntent === "parties"/);
  assert.match(source, /variant === "v1" && mode === "create"/);
  assert.match(source, /<OfferSubtypeClarifier group=\{creationIntent\}/);
});
