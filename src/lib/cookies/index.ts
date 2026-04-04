export type { ConsentSnapshot, CookieCategoryId } from "./consent-types";
export {
  getConsentSnapshot,
  initCookieConsent,
  openCookiePreferences,
  subscribeConsent,
} from "./consent-manager";
export { canUseAnalytics, canUseMarketing, hasConsent } from "./has-consent";
