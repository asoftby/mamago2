import type { FormWizardUiPhase } from "./types";

export function formWizardPhaseFromFlags(flags: {
  isSaving: boolean;
  isSubmitting: boolean;
}): FormWizardUiPhase {
  if (flags.isSubmitting) return "submitting";
  if (flags.isSaving) return "savingDraft";
  return "idle";
}
