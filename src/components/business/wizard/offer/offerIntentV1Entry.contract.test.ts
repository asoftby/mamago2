import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/components/business/wizard/offer/OfferWizard.tsx", "utf8");
const config = readFileSync("src/components/business/wizard/offer/offerWizardSteps.config.ts", "utf8");

test("intent-led creation opens a valid initial step for either wizard variant", () => {
  assert.match(source, /variant === "v2" \? "about" : creationIntent === "parties" \? "placements" : "details"/);
  assert.match(source, /creationIntent === "classes" && \(/);
  assert.match(source, /variant === "v1" && mode === "create"/);
});

test("V1 parties always collect required placements before details", () => {
  assert.match(config, /const isParty = productType === "PARTY_SERVICE" \|\| productType === "PARTY_PACKAGE"/);
  assert.match(config, /isParty \? key !== "conditions" : key !== "placements"/);
  assert.match(source, /case "placements":[\s\S]*?creationIntent === "parties"[\s\S]*?<OfferSubtypeClarifier group="parties"[\s\S]*?<Step2Placements/);
  assert.match(source, /case "details":[\s\S]*?creationIntent === "classes"[\s\S]*?<OfferSubtypeClarifier group="classes"/);
});
