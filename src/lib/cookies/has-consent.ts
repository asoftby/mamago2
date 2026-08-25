/**
 * Синхронные проверки для условной загрузки **сторонних** скриптов.
 * `canUseAnalytics` = внешняя веб-аналитика (Google Analytics 4, Yandex Metrica), не UserEvent в БД.
 * `canUseMarketing` = рекламные пиксели (Meta, TikTok, …).
 * До согласия analytics/marketing всегда false.
 */
import { getConsentSnapshot } from "./consent-manager";

/** Внешние инструменты веб-аналитики (GA4, Yandex Metrica) разрешены (не путать с product telemetry). */
export function canUseAnalytics(): boolean {
  return getConsentSnapshot().analytics;
}

/** Сторонние маркетинговые/рекламные скрипты разрешены. */
export function canUseMarketing(): boolean {
  return getConsentSnapshot().marketing;
}

export function hasConsent(
  category: "analytics" | "marketing",
): boolean {
  return category === "analytics" ? canUseAnalytics() : canUseMarketing();
}
