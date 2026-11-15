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
  // Option (b), 2026-11-16: Google is fully consent-gated like Yandex.
  const googleEffect =
    loader.match(/\/\/ Google is fully consent-gated[\s\S]*?\}, \[canUseAnalytics, config\.enabled, googleId\]\);/)?.[0] ?? "";
  assert.ok(googleEffect, "Google lifecycle must be one effect keyed on canUseAnalytics");
  const deniedBranch = googleEffect.match(/if \(!canUseAnalytics\) \{([\s\S]*?)\n    \}\n/)?.[1] ?? "";
  assert.ok(
    deniedBranch.includes("return;") &&
      !deniedBranch.includes("mamago-google-analytics") &&
      !deniedBranch.includes('"config"') &&
      !deniedBranch.includes('"default"'),
    "Without analytics consent Google must not be loaded, configured or given a consent default",
  );
  assert.ok(
    googleEffect.indexOf("if (!canUseAnalytics)") <
      googleEffect.indexOf('"mamago-google-analytics"'),
    "Google script insertion must come after the analytics-consent gate",
  );
  assert.ok(
    /w\[disableKey\] = true;[\s\S]*?"consent", "update", GOOGLE_DENIED_CONSENT/.test(deniedBranch) &&
      /googleInitializedRef\.current/.test(deniedBranch),
    "Revoke after load must set ga-disable-<id> and deny analytics_storage (gtag.js cannot be unloaded)",
  );
  assert.ok(
    /w\[disableKey\] = false;[\s\S]*?"consent", "update", GOOGLE_GRANTED_ANALYTICS_CONSENT/.test(googleEffect),
    "Re-accept after revoke must clear ga-disable and grant analytics_storage",
  );
  assert.ok(
    /const GOOGLE_GRANTED_ANALYTICS_CONSENT\s*=\s*\{\s*\.\.\.GOOGLE_DENIED_CONSENT,\s*analytics_storage:\s*"granted",\s*\}\s*as const/.test(loader) &&
      loader.includes('ad_storage: "denied"') &&
      loader.includes('ad_user_data: "denied"') &&
      loader.includes('ad_personalization: "denied"'),
    "Granting analytics must keep every advertising consent category denied",
  );
  assert.ok(
    !loader.includes("wait_for_update"),
    "wait_for_update is not needed: Google is initialized only once consent is known",
  );
  const consentDefault = loader.indexOf('gtag("consent", "default", GOOGLE_GRANTED_ANALYTICS_CONSENT)');
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
    /if\s*\(googleInitializedRef\.current\)\s*\{[^}]*"consent", "update"[^}]*return;\s*\}/.test(loader) &&
      /googleInitializedRef\.current\s*=\s*true/.test(loader),
    "Google script/js/config initialization must be guarded against consent-update reinitialization",
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
    "Cookie consent revision must stay 2: gating GA on consent is stricter, existing choices stay valid",
  );
  assert.ok(
    !consentConfig.includes("до вашего согласия") &&
      !consentConfig.includes("До согласия Google"),
    "Consent copy must not claim Google runs before consent",
  );
  assert.ok(
    consentConfig.includes("_ym_"),
    "Cookie consent analytics category must auto-clear first-party Yandex Metrica cookies",
  );

  console.log("externalAnalyticsContract.test.ts: OK");
}

main();
