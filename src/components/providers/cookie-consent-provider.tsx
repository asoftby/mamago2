"use client";

/**
 * Инициализация CookieConsent один раз на клиенте (без SSR).
 *
 * Стили библиотеки + mamaGo overrides НЕ импортируются здесь статически:
 * первый экран (первый визит и «известное» согласие) полностью покрывается
 * первопейнт-шеллом (CookieConsentShell, Tailwind-классы из globals.css) и
 * критичным no-flash правилом в src/app/layout.tsx. Тяжёлые стили самой
 * библиотеки нужны только когда открывается Preferences — см.
 * cookie-consent-preferences-styles.ts и openCookiePreferencesFromShell().
 *
 * Скрипты аналитики/маркетинга: см. AnalyticsLoader / MarketingLoader.
 */
import { useEffect } from "react";
import { initCookieConsent } from "@/lib/cookies/consent-manager";
import { AnalyticsLoader } from "@/components/analytics/analytics-loader";
import { MarketingLoader } from "@/components/analytics/marketing-loader";
import { CookieConsentShell } from "./CookieConsentShell";
import type { ExternalAnalyticsConfig } from "@/lib/analytics/externalAnalyticsTypes";

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

    void initCookieConsent().catch((err) => {
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
