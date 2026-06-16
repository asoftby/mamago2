import { MY_PLAN_REG_FOCUS_CHILD_SESSION_KEY } from "@/lib/family/postMyPlanRegistrationFocus";
import { AUTH_STATE_CHANGED_EVENT } from "@/lib/auth/client";

const ACCOUNT_MODE_KEY = "mamago.accountMode";
const SELECTED_PERSONA_IDS_KEY = "mamago:selectedPersonaIds";
const BUSINESS_ONBOARDING_DRAFT_PREFIX = "mg_business_onboarding_draft_v1";

/** Сброс client-only состояния, связанного с аккаунтом (после redirect на /?loggedOut=1). */
export function clearLogoutClientStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACCOUNT_MODE_KEY);
    window.localStorage.removeItem(SELECTED_PERSONA_IDS_KEY);
    window.sessionStorage.removeItem(MY_PLAN_REG_FOCUS_CHILD_SESSION_KEY);

    // Sweep any business onboarding drafts (legacy global key + per-user scoped keys)
    // left behind by accounts that previously signed out on this browser.
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(BUSINESS_ONBOARDING_DRAFT_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    }

    window.dispatchEvent(new CustomEvent(AUTH_STATE_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}
