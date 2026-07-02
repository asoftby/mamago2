import type { PlaceFormData } from "./types";

export interface PlaceWizardDraftData {
  currentStep: number;
  formData: PlaceFormData;
}

export function normalizeRestoredPlaceWizardStep(
  draft: PlaceWizardDraftData,
  totalSteps: number,
): number {
  if (
    typeof draft.currentStep === "number" &&
    Number.isInteger(draft.currentStep) &&
    draft.currentStep >= 1 &&
    draft.currentStep <= totalSteps
  ) {
    return draft.currentStep;
  }

  return 1;
}
