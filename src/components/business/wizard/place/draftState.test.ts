import * as assert from "node:assert/strict";

import { getDefaultFormData } from "./defaults";
import {
  normalizeRestoredPlaceWizardStep,
  type PlaceWizardDraftData,
} from "./draftState";

function createDraft(overrides: Partial<PlaceWizardDraftData>): PlaceWizardDraftData {
  return {
    currentStep: 1,
    formData: getDefaultFormData(),
    ...overrides,
  };
}

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

console.log("place draft state tests: OK");
