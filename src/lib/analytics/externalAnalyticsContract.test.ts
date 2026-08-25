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
    "AnalyticsLoader must gate provider loading on analytics consent",
  );
  assert.ok(
    loader.includes("ga-disable-"),
    "AnalyticsLoader must set the GA opt-out flag for revoke handling",
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
    revisionMatch && Number(revisionMatch[1]) > 0,
    "Cookie consent revision must be > 0 once the external provider set changed, to force re-consent",
  );
  assert.ok(
    consentConfig.includes("_ym_"),
    "Cookie consent analytics category must auto-clear first-party Yandex Metrica cookies",
  );

  console.log("externalAnalyticsContract.test.ts: OK");
}

main();
