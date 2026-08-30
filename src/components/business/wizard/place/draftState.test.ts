import * as assert from "node:assert/strict";

import { getDefaultFormData } from "./defaults";
import {
  normalizeRestoredPlaceWizardStep,
  type PlaceWizardDraftData,
} from "./draftState";
import { getPlaceWizardStepKeys, getPlaceWizardTotalSteps } from "./config";

function createDraft(overrides: Partial<PlaceWizardDraftData>): PlaceWizardDraftData {
  return {
    currentStep: 1,
    formData: getDefaultFormData(),
    ...overrides,
  };
}

/** Simulates a draft read back from localStorage (JSON.parse — untyped at runtime). */
function createUntypedDraft(overrides: Record<string, unknown>): PlaceWizardDraftData {
  return {
    currentStep: 1,
    formData: getDefaultFormData(),
    ...overrides,
  } as PlaceWizardDraftData;
}

// ── Legacy numeric-only behavior (pre-existing, must keep working) ──────────────

assert.equal(
  normalizeRestoredPlaceWizardStep(createDraft({ currentStep: 6 }), 8),
  6,
  "CTA step is restored when it is within range",
);

assert.equal(
  normalizeRestoredPlaceWizardStep(createDraft({ currentStep: 7 }), 7),
  7,
  "legacy FAQ/review range is preserved",
);

assert.equal(
  normalizeRestoredPlaceWizardStep(createDraft({ currentStep: 999 }), 8),
  1,
  "out-of-range step falls back to the first step",
);

assert.equal(
  normalizeRestoredPlaceWizardStep(createDraft({ currentStep: 0 }), 8),
  1,
  "zero falls back to the first step",
);

// ── Semantic step key resolution ────────────────────────────────────────────────

const totalStepsCtaOff = getPlaceWizardTotalSteps(false);
const totalStepsCtaOn = getPlaceWizardTotalSteps(true);

assert.equal(
  normalizeRestoredPlaceWizardStep(
    createDraft({ currentStepKey: "faq", currentStep: 1 }),
    totalStepsCtaOff,
    false,
  ),
  6,
  "a new draft with currentStepKey=faq restores to the actual FAQ number when CTA is off",
);

assert.equal(
  normalizeRestoredPlaceWizardStep(
    createDraft({ currentStepKey: "faq", currentStep: 1 }),
    totalStepsCtaOn,
    true,
  ),
  7,
  "the same semantic FAQ draft restores to a different actual number when CTA is on",
);

assert.equal(
  normalizeRestoredPlaceWizardStep(
    createDraft({ currentStep: 3 }),
    totalStepsCtaOff,
    false,
  ),
  3,
  "an old draft with no currentStepKey keeps restoring via the legacy numeric currentStep",
);

assert.equal(
  normalizeRestoredPlaceWizardStep(
    createUntypedDraft({ currentStepKey: "menu", currentStep: 4 }),
    totalStepsCtaOff,
    false,
  ),
  4,
  "an unrecognized/invalid step key falls back to the legacy numeric currentStep",
);

assert.equal(
  normalizeRestoredPlaceWizardStep(
    createDraft({ currentStepKey: "cta", currentStep: 2 }),
    totalStepsCtaOff,
    false,
  ),
  2,
  "a currentStepKey naming a currently-disabled conditional step (cta off) falls back to the legacy numeric currentStep",
);

assert.equal(
  normalizeRestoredPlaceWizardStep(
    createDraft({ currentStepKey: "cta", currentStep: 999 }),
    totalStepsCtaOff,
    false,
  ),
  1,
  "disabled conditional step key combined with an invalid numeric fallback lands on the first step",
);

// ── Layout sanity: this migration must not change step order/labels ─────────────

assert.deepEqual(
  getPlaceWizardStepKeys(false),
  ["profile", "location", "contacts", "photos", "openingHours", "faq", "review"],
  "CTA-off step layout is unchanged",
);

assert.deepEqual(
  getPlaceWizardStepKeys(true),
  ["profile", "location", "contacts", "photos", "openingHours", "cta", "faq", "review"],
  "CTA-on step layout is unchanged",
);

console.log("place draft state tests: OK");
