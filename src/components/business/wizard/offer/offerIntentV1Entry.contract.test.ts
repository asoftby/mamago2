import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/components/business/wizard/offer/OfferWizard.tsx", "utf8");
const config = readFileSync("src/components/business/wizard/offer/offerWizardSteps.config.ts", "utf8");
const v2 = readFileSync("src/components/business/wizard/offer/offerWizardV2Steps.ts", "utf8");
const quickMenu = readFileSync("src/components/shared/CreatePublicationQuickMenu.tsx", "utf8");

test("every business menu offer starts on V2 step one with its type preselected", () => {
  assert.match(source, /const variant: OfferWizardVariant = "v2";/);
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
  assert.match(source, /const idx = Math\.min\(initialStepNumber, initialSteps.length\) - 1;/);
  assert.doesNotMatch(source, /OfferSubtypeClarifier|variant === "v1"/,
    "V1 subtype clarifiers must not appear in the universally enabled V2 wizard");
});

test("party and class details are part of V2 composite steps without repeated subtype prompts", () => {
  assert.match(config, /if \(variant === "v2"\) return V2_STEPS;\s*if \(!type\) return \[\];/);
  assert.match(v2, /case "about":/);
  assert.match(v2, /isParty \? \["placements", "details", "photo"\]/);
  assert.match(source, /case "placements":\s*return <Step2Placements[^;]*v2 \/>;/);
  assert.match(source, /case "details":\s*return <Step2Information[^;]*v2 \/>;/);
});
