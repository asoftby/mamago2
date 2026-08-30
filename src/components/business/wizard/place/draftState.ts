import type { PlaceFormData } from "./types";
import {
  getPlaceWizardStepNumber,
  PLACE_WIZARD_STEP_DEFINITIONS,
  type WizardStepKey,
} from "./config";

export interface PlaceWizardDraftData {
  /**
   * Canonical semantic step identity. Optional so drafts saved before this
   * field existed (or written by some other older client) still parse —
   * `readWizardDraft` does not validate shape beyond `schemaVersion`.
   */
  currentStepKey?: WizardStepKey;
  /**
   * Legacy numeric step identity. Always populated on save (never removed):
   * it's the only identity older drafts have, and it's also the fallback
   * whenever `currentStepKey` can't be trusted (unknown, or a conditional
   * step that's currently disabled).
   */
  currentStep: number;
  formData: PlaceFormData;
}

function isKnownWizardStepKey(value: unknown): value is WizardStepKey {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(PLACE_WIZARD_STEP_DEFINITIONS, value)
  );
}

function normalizeLegacyStep(currentStep: unknown, totalSteps: number): number {
  if (
    typeof currentStep === "number" &&
    Number.isInteger(currentStep) &&
    currentStep >= 1 &&
    currentStep <= totalSteps
  ) {
    return currentStep;
  }

  return 1;
}

/**
 * Resolves the step to restore a draft on.
 *
 * `currentStepKey` (semantic) takes priority whenever it names a real step
 * AND that step is part of the CURRENT active layout for `ctaStepEnabled`
 * — `getPlaceWizardStepNumber` returns `null` for a key that's a known step
 * but currently disabled (e.g. `cta` when the CTA step is off), which is
 * exactly the signal to fall through to the legacy path below. This keeps
 * restore correct even when conditional steps shift what a given numeric
 * position means between when the draft was saved and when it's restored.
 *
 * Falls back to the legacy numeric `currentStep` — clamped/normalized into
 * `[1, totalSteps]` — when the key is absent (older drafts), not a real step
 * key, or currently disabled. Falls back to the first step if neither is
 * valid.
 */
export function normalizeRestoredPlaceWizardStep(
  draft: PlaceWizardDraftData,
  totalSteps: number,
  ctaStepEnabled = false,
): number {
  if (isKnownWizardStepKey(draft.currentStepKey)) {
    const resolved = getPlaceWizardStepNumber(draft.currentStepKey, ctaStepEnabled);
    if (resolved !== null) return resolved;
  }

  return normalizeLegacyStep(draft.currentStep, totalSteps);
}
