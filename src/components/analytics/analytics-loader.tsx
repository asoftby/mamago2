"use client";

/**
 * Consent-aware loader for third-party web analytics only.
 * First-party product telemetry (UserEvent) is intentionally separate.
 *
 * Contract:
 * - rendered only for public pages;
 * - runtime config is fail-closed on the server;
 * - Google uses Advanced Consent Mode and loads after a denied default;
 * - Yandex remains fully gated by analytics consent;
 * - consent withdrawal updates Google consent and destructs Yandex;
 * - Google pageviews rely on GA4 Enhanced Measurement history changes;
 * - Yandex SPA views use defer:true + explicit hit calls.
 */
import { Suspense, useEffect, useRef, useState } from "react";
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
  if (!w.gtag) {
    // Must match Google's official gtag.js snippet byte-for-byte in
    // semantics: `function(){dataLayer.push(arguments)}`. gtag.js's queue
    // processor is written against that exact shape; an arrow function
    // wrapping rest args into a new array is not the same object gtag.js
    // expects to find queued.
    w.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params -- must mirror the official snippet's `arguments` object, not a rest-collected array
      w.dataLayer!.push(arguments);
    };
  }
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

const GOOGLE_DENIED_CONSENT = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
} as const;

function clearYandexLocalStorage(): void {
  try {
    const remove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (
        key === "_ym_uid" ||
        key === "_ym_retryReqs" ||
        key === "_ym_hide_phones" ||
        /^_ym\d+_(lastHit|lsid|reqNum)$/.test(key) ||
        /^ytm_(tf|tag)_/.test(key)
      ) {
        remove.push(key);
      }
    }
    for (const key of remove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable in privacy modes; provider is already stopped.
  }
}

function YandexRouteTracker({ counterId }: { counterId: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastUrlRef = useRef<string | null>(null);
  const query = searchParams.toString();
  const routeKey = `${pathname}${query ? `?${query}` : ""}`;

  useEffect(() => {
    const currentUrl = window.location.href;
    if (lastUrlRef.current === currentUrl) return;

    const ym = analyticsWindow().ym;
    if (!ym) return;

    const previousUrl = lastUrlRef.current;
    ym(counterId, "hit", currentUrl, {
      title: document.title,
      ...(previousUrl || document.referrer
        ? { referer: previousUrl ?? document.referrer }
        : {}),
    });
    lastUrlRef.current = currentUrl;
  }, [counterId, routeKey]);

  return null;
}

export function AnalyticsLoader({
  config,
}: {
  config: ExternalAnalyticsConfig;
}) {
  const { canUseAnalytics } = useCookieConsent();
  const yandexActiveRef = useRef(false);
  const googleInitializedRef = useRef(false);
  const [yandexReady, setYandexReady] = useState(false);

  const googleId = config.enabled ? config.googleAnalyticsId : null;
  const yandexId = config.enabled ? config.yandexMetrikaId : null;

  // Google lifecycle is independent of analytics consent. The denied default
  // MUST be queued before gtag.js is inserted; initialization happens once.
  useEffect(() => {
    if (!config.enabled || !googleId) return;

    if (!googleInitializedRef.current) {
      const gtag = ensureGtag();
      gtag("consent", "default", GOOGLE_DENIED_CONSENT);
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
      googleInitializedRef.current = true;
    }

    ensureGtag()("consent", "update", {
      ...GOOGLE_DENIED_CONSENT,
      analytics_storage: canUseAnalytics ? "granted" : "denied",
    });
  }, [canUseAnalytics, config.enabled, googleId]);

  // Yandex remains fully consent-gated and is destroyed on revoke.
  useEffect(() => {
    if (!config.enabled) return;

    if (!canUseAnalytics) {
      if (yandexId && yandexActiveRef.current) {
        const ym = analyticsWindow().ym;
        if (ym) ym(yandexId, "destruct");
        yandexActiveRef.current = false;
        const readyTimer = window.setTimeout(() => setYandexReady(false), 0);
        clearYandexLocalStorage();
        return () => window.clearTimeout(readyTimer);
      }
      clearYandexLocalStorage();
      return;
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
      const readyTimer = window.setTimeout(() => setYandexReady(true), 0);
      return () => window.clearTimeout(readyTimer);
    }
  }, [canUseAnalytics, config.enabled, yandexId]);

  if (!config.enabled || !canUseAnalytics || !yandexId || !yandexReady) {
    return null;
  }

  // useSearchParams lives behind Suspense to preserve static rendering of
  // public routes. No noscript fallback: it would bypass the consent gate.
  return (
    <Suspense fallback={null}>
      <YandexRouteTracker counterId={yandexId} />
    </Suspense>
  );
}
