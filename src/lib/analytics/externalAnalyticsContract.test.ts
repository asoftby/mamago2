/**
 * Source-inspection guard for the external analytics (GA4/Yandex Metrica)
 * contract: consent gating, loader behavior, and provider-tree routing.
 * Complements externalAnalyticsConfig.test.ts (pure config resolver).
 *
 * Run: pnpm exec tsx src/lib/analytics/externalAnalyticsContract.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function main() {
  const loader = source("src/components/analytics/analytics-loader.tsx");

  assert.ok(
    loader.includes("canUseAnalytics"),
    "AnalyticsLoader must react to analytics consent",
  );
  assert.ok(
    !loader.includes("ga-disable-"),
    "Ordinary denied consent must not use ga-disable, which would suppress Advanced Consent Mode pings",
  );
  assert.ok(
    loader.includes('gtag("consent", "default", GOOGLE_DEFAULT_CONSENT)') &&
      loader.includes('analytics_storage: "denied"') &&
      loader.includes('ad_storage: "denied"') &&
      loader.includes('ad_user_data: "denied"') &&
      loader.includes('ad_personalization: "denied"'),
    "GA4 must queue a denied consent default for analytics and every advertising category",
  );
  assert.ok(
    /const GOOGLE_DEFAULT_CONSENT\s*=\s*\{[\s\S]*?\.\.\.GOOGLE_DENIED_CONSENT,[\s\S]*?wait_for_update:\s*500,[\s\S]*?\}\s*as const/.test(loader),
    "GA default consent must wait briefly for async restoration of a persisted choice",
  );
  const consentUpdate = loader.match(/ensureGtag\(\)\("consent", "update", \{([\s\S]*?)\}\);/);
  assert.ok(
    consentUpdate && !consentUpdate[1].includes("wait_for_update"),
    "wait_for_update must never be included in consent update",
  );
  assert.ok(
    loader.includes("const { canUseAnalytics, hasValidConsent } = useCookieConsent()") &&
      /if \(!config\.enabled \|\| !googleId \|\| !hasValidConsent\) return;[\s\S]*?ensureGtag\(\)\("consent", "update"/.test(loader),
    "Google consent update must not run while CookieConsent state is still unknown",
  );
  assert.ok(
    /\[canUseAnalytics, config\.enabled, googleId, hasValidConsent\]/.test(loader),
    "Once consent becomes valid, Google update must react to the current analytics choice",
  );
  const consentDefault = loader.indexOf('gtag("consent", "default", GOOGLE_DEFAULT_CONSENT)');
  const googleScript = loader.indexOf('"mamago-google-analytics"');
  const googleJs = loader.indexOf('gtag("js", new Date())');
  const googleConfig = loader.indexOf('gtag("config", googleId');
  assert.ok(
    consentDefault >= 0 &&
      consentDefault < googleScript &&
      googleScript < googleJs &&
      googleJs < googleConfig,
    "GA order must be consent default -> script -> js -> config",
  );
  assert.ok(
    loader.includes('analytics_storage: canUseAnalytics ? "granted" : "denied"'),
    "Accept and revoke must update analytics_storage without changing advertising consent",
  );
  assert.ok(
    loader.includes("allow_google_signals: false") &&
      loader.includes("allow_ad_personalization_signals: false"),
    "AnalyticsLoader must not enable Google advertising/personalization signals",
  );
  assert.ok(
    loader.includes('"destruct"'),
    "AnalyticsLoader must call Yandex Metrica destruct on consent revoke",
  );
  assert.ok(
    loader.includes("defer: true"),
    "Yandex Metrica init must use defer:true (explicit SPA hits, no double count)",
  );
  assert.ok(
    loader.includes("webvisor: true"),
    "Yandex Metrica init must keep webvisor enabled",
  );
  assert.ok(
    loader.includes('"hit"'),
    "AnalyticsLoader must send explicit Yandex SPA route hits",
  );
  assert.ok(
    !loader.includes("<noscript") && !loader.includes("watch.js"),
    "AnalyticsLoader must not render a Yandex <noscript>/watch pixel fallback (would bypass consent)",
  );
  assert.ok(
    loader.includes("useSearchParams") && loader.includes("Suspense"),
    "Yandex route tracking must keep useSearchParams under Suspense",
  );
  assert.ok(
    !/gtag\(\s*["']event["']\s*,\s*["']page_view["']/.test(loader),
    "AnalyticsLoader must not manually send GA4 page_view (relies on Enhanced Measurement)",
  );

  // gtag queue must mirror Google's official snippet
  // (`function(){dataLayer.push(arguments)}`) exactly: a real `function`
  // pushing the `arguments` object, not an arrow function that collects
  // rest args into a new array before pushing. gtag.js's queue processor
  // is written against the former shape.
  assert.ok(
    /w\.gtag\s*=\s*function\s*gtag\s*\(\s*\)/.test(loader),
    "ensureGtag must assign a named `function` expression to window.gtag, not an arrow function",
  );
  assert.ok(
    loader.includes("w.dataLayer!.push(arguments)"),
    "ensureGtag must push the `arguments` object itself (official gtag.js contract), not a rest-collected array",
  );
  assert.ok(
    !/\(\.\.\.args:\s*unknown\[\]\)\s*=>\s*\{\s*w\.dataLayer!\.push\(args\)/.test(
      loader,
    ),
    "ensureGtag must not regress to the arrow-function/rest-array queue wrapper that diverges from gtag.js's expected arguments-object shape",
  );
  assert.ok(
    loader.includes('gtag("js", new Date())'),
    "AnalyticsLoader must send the gtag('js', ...) init call before config, per the official snippet",
  );
  assert.ok(
    /gtag\(\s*"config"\s*,\s*googleId\s*,/.test(loader),
    "AnalyticsLoader must send gtag('config', measurementId, ...) once during initialization",
  );
  assert.ok(
    /if\s*\(googleInitializedRef\.current\)\s*return/.test(loader) &&
      /googleInitializedRef\.current\s*=\s*true/.test(loader),
    "Google script/js/config initialization must be guarded against consent-update reinitialization",
  );
  assert.ok(
    !/if\s*\(!canUseAnalytics\)[\s\S]{0,500}mamago-google-analytics/.test(loader),
    "Google script loading must not be inside the denied-consent branch",
  );
  assert.ok(
    /if\s*\(!canUseAnalytics\)[\s\S]{0,500}"destruct"/.test(loader),
    "Yandex must remain consent-gated and destruct on revoke",
  );

  const cookieConsentProvider = source(
    "src/components/providers/cookie-consent-provider.tsx",
  );
  assert.ok(
    cookieConsentProvider.includes("AnalyticsLoader"),
    "CookieConsentProvider must mount AnalyticsLoader",
  );

  const publicProviders = source("src/components/providers/PublicProviders.tsx");
  assert.ok(
    publicProviders.includes("CookieConsentProvider"),
    "PublicProviders must mount CookieConsentProvider (and therefore AnalyticsLoader)",
  );

  const rootLayout = source("src/app/layout.tsx");
  const adminLayout = source("src/app/admin/layout.tsx");
  const businessLayout = source("src/app/business/layout.tsx");
  for (const [name, s] of [
    ["root layout", rootLayout],
    ["admin layout", adminLayout],
    ["business layout", businessLayout],
  ] as const) {
    assert.ok(
      !s.includes("AnalyticsLoader") && !s.includes("CookieConsentProvider"),
      `${name} must not mount external AnalyticsLoader directly — it belongs only to the public provider tree`,
    );
  }

  const publicLayout = source("src/app/(public)/layout.tsx");
  assert.ok(
    publicLayout.includes("PublicProviders"),
    "Public route group layout must mount PublicProviders (the only external AnalyticsLoader entry point)",
  );

  const consentConfig = source("src/lib/cookies/consent-config.ts");
  const revisionMatch = consentConfig.match(/revision:\s*(\d+)/);
  assert.ok(
    revisionMatch && Number(revisionMatch[1]) === 2,
    "Cookie consent revision must be 2 for the Advanced Consent Mode semantics change",
  );
  assert.ok(
    consentConfig.includes("_ym_"),
    "Cookie consent analytics category must auto-clear first-party Yandex Metrica cookies",
  );

  console.log("externalAnalyticsContract.test.ts: OK");
}

main();
