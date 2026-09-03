import { CONSENT_COOKIE_NAME, CONSENT_REVISION } from "./consent-cookie-format";

/**
 * Pre-hydration, render-blocking script (see `src/app/layout.tsx`): decides,
 * before the browser paints anything, whether the returning visitor already
 * has valid cookie-consent — and if so, marks `<html>` so CSS can hide the
 * SSR cookie-consent shell (`CookieConsentShell`) before its first paint.
 *
 * Why not a React/server check: reading the request cookie in a server
 * component (`cookies()`/`headers()`) would opt every public route relying
 * on it into per-request dynamic rendering. This runs client-side, costs
 * nothing server-side, and — because it's a classic, non-async/non-deferred
 * `<script>` placed in `<head>` — always executes before the browser's
 * first paint, so a returning consented visitor never sees the shell flash.
 *
 * Mirrors `hasValidConsentCookieValue` (consent-cookie-format.ts) by hand,
 * since a raw inline `<script>` can't import a TS module; kept in sync via
 * `consent-cookie-format.test.ts` (asserts this string embeds the same
 * `CONSENT_COOKIE_NAME`/`CONSENT_REVISION` constants and the same field
 * checks).
 *
 * Never throws: any parse failure just leaves the attribute unset, so the
 * shell stays visible (fail-closed toward *showing* consent UI again).
 */
export function buildNoFlashCookieShellScript(): string {
  return `(function(){try{var m=document.cookie.match(/(?:^|; )${CONSENT_COOKIE_NAME}=([^;]*)/);if(!m)return;var d=JSON.parse(decodeURIComponent(m[1]));if(typeof d.consentId==="string"&&d.consentId&&d.revision===${CONSENT_REVISION}&&Array.isArray(d.categories)&&d.consentTimestamp&&d.lastConsentTimestamp){document.documentElement.setAttribute("data-cc-consent-known","1")}}catch(e){}})();`;
}
