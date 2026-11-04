import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/components/business/wizard/offer/OfferWizard.tsx", "utf8");
const config = readFileSync("src/components/business/wizard/offer/offerWizardSteps.config.ts", "utf8");
const quickMenu = readFileSync("src/components/shared/CreatePublicationQuickMenu.tsx", "utf8");

test("every business menu offer starts at step 1 with its type preselected", () => {
  // Both v1 and v2 must show the type step rather than skipping straight to details.
  assert.match(source, /if \(mode !== "edit" \|\| !offer \|\| initialStepNumber == null \|\| initialStepNumber < 1\) \{\s*\/\/[^\n]*\n\s*return "type";/);
  for (const [intent, productType] of [
    ["place", "PLACE_VISIT"],
    ["classes", "REGULAR_ACTIVITY"],
    ["parties", "PARTY_SERVICE"],
    ["camps", "CAMP"],
  ]) {
    assert.ok(quickMenu.includes(`href: "/editor/offer/new?creationIntent=${intent}"`), `menu link: ${intent}`);
    assert.ok(source.includes(`creationIntent === "${intent}" ? "${productType}"`), `preselection: ${intent}`);
  }
  // Editing still honors the requested step, and v1 subtype clarifiers remain available.
  assert.match(source, /const idx = Math\.min\(initialStepNumber, initialSteps.length\) - 1;/);
  assert.match(source, /creationIntent === "classes" && \(/);
  assert.match(source, /variant === "v1" && mode === "create"/);
});

test("V1 parties always collect required placements before details", () => {
  assert.match(config, /const isParty = productType === "PARTY_SERVICE" \|\| productType === "PARTY_PACKAGE"/);
  assert.match(config, /isParty \? key !== "conditions" : key !== "placements"/);
  assert.match(source, /case "placements":[\s\S]*?creationIntent === "parties"[\s\S]*?<OfferSubtypeClarifier group="parties"[\s\S]*?<Step2Placements/);
  assert.match(source, /case "details":[\s\S]*?creationIntent === "classes"[\s\S]*?<OfferSubtypeClarifier group="classes"/);
});
