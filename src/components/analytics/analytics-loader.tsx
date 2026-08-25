"use client";

/**
 * Consent-aware loader for third-party web analytics only.
 * First-party product telemetry (UserEvent) is intentionally separate.
 *
 * Contract:
 * - rendered only for public pages;
 * - runtime config is fail-closed on the server;
 * - no provider script is inserted before analytics consent;
 * - consent withdrawal disables/destructs already-loaded providers;
 * - Google pageviews rely on GA4 Enhanced Measurement history changes;
 * - Yandex SPA views use defer:true + explicit hit calls.
 */
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { ExternalAnalyticsConfig } from "@/lib/analytics/externalAnalyticsTypes";
import { useCookieConsent } from "@/hooks/use-cookie-consent";

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  ym?: ((...args: unknown[]) => void) & {
    a?: unknown[][];
    l?: number;
  };
};

function analyticsWindow(): AnalyticsWindow {
  return window as AnalyticsWindow;
}

function ensureExternalScript(id: string, src: string): void {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function ensureGtag(): NonNullable<AnalyticsWindow["gtag"]> {
  const w = analyticsWindow();
  w.dataLayer = w.dataLayer ?? [];
  w.gtag =
    w.gtag ??
    ((...args: unknown[]) => {
      w.dataLayer!.push(args);
    });
  return w.gtag;
}

function ensureYm(): NonNullable<AnalyticsWindow["ym"]> {
  const w = analyticsWindow();
  if (!w.ym) {
    const queued = ((...args: unknown[]) => {
      queued.a = queued.a ?? [];
      queued.a.push(args);
    }) as NonNullable<AnalyticsWindow["ym"]>;
    queued.l = Date.now();
    w.ym = queued;
  }
  return w.ym;
}

function setGoogleDisabled(measurementId: string, disabled: boolean): void {
  const w = window as Window & Record<string, unknown>;
  w[`ga-disable-${measurementId}`] = disabled;
}

export function AnalyticsLoader({
  config,
}: {
  config: ExternalAnalyticsConfig;
}) {
  const { canUseAnalytics } = useCookieConsent();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const yandexActiveRef = useRef(false);
  const lastYandexUrlRef = useRef<string | null>(null);

  const googleId = config.enabled ? config.googleAnalyticsId : null;
  const yandexId = config.enabled ? config.yandexMetrikaId : null;
  const query = searchParams.toString();
  const routeKey = `${pathname}${query ? `?${query}` : ""}`;

  // Provider lifecycle: load only after consent; actively disable on revoke.
  useEffect(() => {
    if (!config.enabled) return;

    if (!canUseAnalytics) {
      if (googleId) {
        setGoogleDisabled(googleId, true);
      }
      if (yandexId && yandexActiveRef.current) {
        const ym = analyticsWindow().ym;
        if (ym) ym(yandexId, "destruct");
        yandexActiveRef.current = false;
        lastYandexUrlRef.current = null;
      }
      return;
    }

    if (googleId) {
      setGoogleDisabled(googleId, false);
      const gtag = ensureGtag();
      ensureExternalScript(
        "mamago-google-analytics",
        `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleId)}`,
      );
      gtag("js", new Date());
      gtag("config", googleId, {
        // Marketing/advertising consent is a separate mamaGo category.
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      });
    }

    if (yandexId && !yandexActiveRef.current) {
      const ym = ensureYm();
      ensureExternalScript(
        "mamago-yandex-metrika",
        "https://mc.yandex.ru/metrika/tag.js",
      );
      ym(yandexId, "init", {
        defer: true,
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
        webvisor: true,
      });
      yandexActiveRef.current = true;
      lastYandexUrlRef.current = null;
    }
  }, [canUseAnalytics, config.enabled, googleId, yandexId]);

  // Yandex requires explicit SPA hits when initialized with defer:true.
  useEffect(() => {
    if (!config.enabled || !canUseAnalytics || !yandexId) return;
    if (!yandexActiveRef.current) return;

    const currentUrl = window.location.href;
    if (lastYandexUrlRef.current === currentUrl) return;

    const ym = analyticsWindow().ym;
    if (!ym) return;

    const previousUrl = lastYandexUrlRef.current;
    ym(yandexId, "hit", currentUrl, {
      title: document.title,
      ...(previousUrl || document.referrer
        ? { referer: previousUrl ?? document.referrer }
        : {}),
    });
    lastYandexUrlRef.current = currentUrl;
  }, [routeKey, canUseAnalytics, config.enabled, yandexId]);

  // No noscript fallback by design: it would bypass the analytics-consent gate.
  return null;
}
