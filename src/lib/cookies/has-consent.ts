/**
 * Синхронные проверки для условной загрузки **сторонних** скриптов.
 * `canUseAnalytics` = внешняя веб-аналитика (GTM, gtag, PostHog и т.д.), не UserEvent в БД.
 * `canUseMarketing` = рекламные пиксели (Meta, TikTok, …).
 * До согласия analytics/marketing всегда false.
 */
import { getConsentSnapshot } from "./consent-manager";

/** Внешние инструменты веб-аналитики разрешены (не путать с product telemetry). */
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
