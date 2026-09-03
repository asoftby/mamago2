"use client";

/**
 * Инициализация CookieConsent один раз на клиенте (без SSR).
 * Подключает стили библиотеки + mamaGo overrides.
 *
 * Скрипты аналитики/маркетинга: см. AnalyticsLoader / MarketingLoader.
 */
import { useEffect } from "react";
import { ensureConsentModalShown } from "@/lib/cookies/consent-manager";
import { AnalyticsLoader } from "@/components/analytics/analytics-loader";
import { MarketingLoader } from "@/components/analytics/marketing-loader";
import { CookieConsentShell } from "./CookieConsentShell";
import type { ExternalAnalyticsConfig } from "@/lib/analytics/externalAnalyticsTypes";

import "vanilla-cookieconsent/dist/cookieconsent.css";
import "@/styles/cookie-consent-mamago.css";

const TEMP_DISABLE_COOKIE_CONSENT = false;

export function CookieConsentProvider({
  children,
  externalAnalytics,
}: {
  children: React.ReactNode;
  externalAnalytics: ExternalAnalyticsConfig;
}) {
  useEffect(() => {
    if (TEMP_DISABLE_COOKIE_CONSENT) return;

    // Owns the "show the real modal if needed" decision (autoShow is off in
    // consent-config.ts) so CookieConsentShell can hand off deterministically.
    void ensureConsentModalShown().catch((err) => {
      console.error("[CookieConsent] init failed", err);
    });
  }, []);

  return (
    <>
      {children}
      {!TEMP_DISABLE_COOKIE_CONSENT ? <CookieConsentShell /> : null}
      <AnalyticsLoader config={externalAnalytics} />
      <MarketingLoader />
    </>
  );
}
