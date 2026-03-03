/**
 * Business Onboarding Draft Storage
 * Persists form data in localStorage to survive page refreshes
 */

const DRAFT_KEY = "mg_business_onboarding_draft_v1";

export interface BusinessOnboardingDraft {
  unp?: string;
  companyData?: {
    legalName?: string;
    source?: string | null;
  };
  phoneE164?: string;
  updatedAt?: number;
}

/**
 * Load draft from localStorage
 * Returns null if no draft exists or if draft is invalid
 */
export function loadDraft(): BusinessOnboardingDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = localStorage.getItem(DRAFT_KEY);
    if (!stored) {
      return null;
    }

    const draft = JSON.parse(stored);

    // Basic validation
    if (typeof draft !== "object" || draft === null) {
      return null;
    }

    // Validate shape
    const validated: BusinessOnboardingDraft = {};

    if (typeof draft.unp === "string") {
      validated.unp = draft.unp;
    }

    if (draft.companyData && typeof draft.companyData === "object") {
      validated.companyData = {
        legalName:
          typeof draft.companyData.legalName === "string"
            ? draft.companyData.legalName
            : undefined,
        source:
          typeof draft.companyData.source === "string"
            ? draft.companyData.source
            : undefined,
      };
    }

    if (typeof draft.phoneE164 === "string") {
      validated.phoneE164 = draft.phoneE164;
    }

    if (typeof draft.updatedAt === "number") {
      validated.updatedAt = draft.updatedAt;
    }

    return validated;
  } catch (error) {
    console.error("Failed to load draft:", error);
    return null;
  }
}

/**
 * Save partial draft to localStorage
 * Merges with existing draft
 */
export function saveDraft(partial: Partial<BusinessOnboardingDraft>): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const existing = loadDraft() || {};
    const updated: BusinessOnboardingDraft = {
      ...existing,
      ...partial,
      updatedAt: Date.now(),
    };

    localStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to save draft:", error);
  }
}

/**
 * Clear draft from localStorage
 */
export function clearDraft(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (error) {
    console.error("Failed to clear draft:", error);
  }
}
