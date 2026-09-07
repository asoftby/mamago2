import { CONSENT_COOKIE_NAME, CONSENT_REVISION } from "./consent-cookie-format";

/** Runs in <head> before first paint and hides the shell for valid returning consent. */
export function buildNoFlashCookieShellScript(): string {
  return `(function(){try{var m=document.cookie.match(/(?:^|; )${CONSENT_COOKIE_NAME}=([^;]*)/);if(!m)return;var d=JSON.parse(decodeURIComponent(m[1]));if(typeof d.consentId==="string"&&d.consentId&&d.revision===${CONSENT_REVISION}&&Array.isArray(d.categories)&&d.consentTimestamp&&d.lastConsentTimestamp){document.documentElement.setAttribute("data-cc-consent-known","1")}}catch(e){}})();`;
}
