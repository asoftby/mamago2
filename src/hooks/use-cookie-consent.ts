"use client";

import { useEffect, useState } from "react";
import type { ConsentSnapshot } from "@/lib/cookies/consent-types";
import {
  getConsentSnapshot,
  openCookiePreferences,
  subscribeConsent,
} from "@/lib/cookies/consent-manager";

/**
 * Реактивное согласие + openPreferences для кнопок «Настройки cookies».
 * До гидрации отражает снимок по умолчанию (analytics/marketing false).
 *
 * `canUseAnalytics` / `canUseMarketing` — только для **внешних** скриптов (см. AnalyticsLoader).
 * Продуктовая телеметрия (UserEvent) этим флагам не соответствует.
 */
export function useCookieConsent() {
  const [state, setState] = useState<ConsentSnapshot>(() =>
    getConsentSnapshot(),
  );

  useEffect(() => {
    return subscribeConsent(setState);
  }, []);

  return {
    ...state,
    /** Внешняя веб-аналитика (GA4, Yandex Metrica), не product telemetry */
    canUseAnalytics: state.analytics,
    /** Сторонние рекламные скрипты */
    canUseMarketing: state.marketing,
    openPreferences: openCookiePreferences,
  };
}
