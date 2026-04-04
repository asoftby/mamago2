"use client";

/**
 * Условная загрузка **сторонней** веб-аналитики (GA, GTM, PostHog и т.д.).
 * Только при согласии категории `analytics` в cookie-баннере.
 *
 * Не включает и не относится к first-party телеметрии (UserEvent, POST /api/analytics/events).
 *
 * Альтернатива: статические теги с перехватом плагином (manageScriptTags: true):
 *   <script type="text/plain" data-category="analytics" src="..." />
 * После согласия CookieConsent выполнит скрипт.
 *
 * Пример Next.js:
 *   import Script from "next/script";
 *   {canUseAnalytics && <Script src="https://www.googletagmanager.com/gtag/js?id=G-XXX" />}
 */
import { useCookieConsent } from "@/hooks/use-cookie-consent";

export function AnalyticsLoader() {
  const { canUseAnalytics } = useCookieConsent();

  if (!canUseAnalytics) {
    return null;
  }

  return (
    <>
      {/* Заглушка: подключите GTM / gtag / PostHog здесь после получения ID */}
    </>
  );
}
