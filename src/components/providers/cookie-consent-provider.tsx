"use client";

/**
 * Инициализация CookieConsent один раз на клиенте (без SSR).
 * Подключает стили библиотеки + mamaGo overrides.
 *
 * Скрипты аналитики/маркетинга: см. AnalyticsLoader / MarketingLoader в layout.
 */
import { useEffect } from "react";
import { initCookieConsent } from "@/lib/cookies/consent-manager";
import { AnalyticsLoader } from "@/components/analytics/analytics-loader";
import { MarketingLoader } from "@/components/analytics/marketing-loader";

import "vanilla-cookieconsent/dist/cookieconsent.css";
import "@/styles/cookie-consent-mamago.css";

export function CookieConsentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    void initCookieConsent().catch((err) => {
      console.error("[CookieConsent] init failed", err);
    });
  }, []);

  return (
    <>
      {children}
      <AnalyticsLoader />
      <MarketingLoader />
    </>
  );
}
