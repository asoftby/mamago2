/**
 * UI state for entity wizards (Place / Event / Offer).
 * Kept entity-agnostic for reuse in admin/editor shells later.
 */
export type FormWizardUiPhase =
  | "idle"
  | "loading"
  | "validating"
  | "savingDraft"
  | "submitting"
  | "error";

/** Labels for the sticky action bar — always injected from the page / product layer */
export interface FormWizardActionLabels {
  back: string;
  next: string;
  saveDraft: string;
  savingDraft: string;
  submit: string;
  submitting: string;
}

export interface FormWizardSegment {
  id: number;
  /** Accessible name / tooltip */
  title: string;
}
