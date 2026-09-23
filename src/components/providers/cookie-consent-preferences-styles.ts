/**
 * CSS for vanilla-cookieconsent's own modal markup + mamaGo overrides.
 *
 * Loaded lazily (dynamic import) so it never blocks first paint: the
 * first-paint shell (CookieConsentShell) is styled entirely by Tailwind
 * utilities from globals.css, and the library's own consent modal is never
 * auto-shown (autoShow: false). This stylesheet is only needed once the
 * Preferences modal is about to become visible — see
 * openCookiePreferencesFromShell() in consent-manager.ts, which awaits this
 * import before calling showPreferences().
 */
import "vanilla-cookieconsent/dist/cookieconsent.css";
import "@/styles/cookie-consent-mamago.css";
