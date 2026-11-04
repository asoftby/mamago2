import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("all offer editor entrypoints always use six-step V2", () => {
  const wizard = readFileSync("src/components/business/wizard/offer/OfferWizard.tsx", "utf8");
  assert.match(wizard, /const variant: OfferWizardVariant = "v2";/);
  assert.doesNotMatch(wizard, /newWizard/);
  for (const path of [
    "src/app/(content-editor)/editor/offer/new/page.tsx",
    "src/app/(content-editor)/editor/offer/[id]/edit/page.tsx",
  ]) {
    const page = readFileSync(path, "utf8");
    assert.match(page, /<OfferWizard/);
    assert.doesNotMatch(page, /isOfferWizardV2Enabled|newWizard=/);
  }
});
