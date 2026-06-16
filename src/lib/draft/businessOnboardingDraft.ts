/**
 * Business Onboarding Draft Storage
 * Persists form data in localStorage to survive page refreshes.
 *
 * The storage key is scoped per userId so that switching accounts on the
 * same browser never resurfaces a previous user's unsaved draft.
 */

const DRAFT_KEY_PREFIX = "mg_business_onboarding_draft_v1:";
/** Legacy global key used before drafts were user-scoped — only ever removed, never read. */
const LEGACY_DRAFT_KEY = "mg_business_onboarding_draft_v1";

function draftKey(userId: string): string {
  return `${DRAFT_KEY_PREFIX}${userId}`;
}

export interface BusinessOnboardingDraft {
  unp?: string;
  companyData?: {
    legalName?: string;
    source?: string | null;
  };
  phoneE164?: string;
  verifiedPhoneE164?: string;
  updatedAt?: number;
}

/**
 * Load draft from localStorage
 * Returns null if no draft exists or if draft is invalid
 */
export function loadDraft(userId: string): BusinessOnboardingDraft | null {
  if (typeof window === "undefined" || !userId) {
    return null;
  }

  try {
    const stored = localStorage.getItem(draftKey(userId));
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

    if (typeof draft.verifiedPhoneE164 === "string") {
      validated.verifiedPhoneE164 = draft.verifiedPhoneE164;
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
export function saveDraft(
  userId: string,
  partial: Partial<BusinessOnboardingDraft>
): void {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  try {
    const existing = loadDraft(userId) || {};
    const updated: BusinessOnboardingDraft = {
      ...existing,
      ...partial,
      updatedAt: Date.now(),
    };

    localStorage.setItem(draftKey(userId), JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to save draft:", error);
  }
}

/**
 * Clear draft from localStorage
 */
export function clearDraft(userId: string): void {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  try {
    localStorage.removeItem(draftKey(userId));
  } catch (error) {
    console.error("Failed to clear draft:", error);
  }
}

/** Removes the pre-user-scoping global draft key, if it still lingers from an older session. */
export function clearLegacyGlobalDraft(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(LEGACY_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
