/**
 * Центральная точка: инициализация vanilla-cookieconsent (только в браузере),
 * снимок согласия, подписка для React, открытие модалки настроек.
 *
 * Открыть настройки из футера: import { openCookiePreferences } from "@/lib/cookies/consent-manager"
 *
 * Согласие `analytics` / `marketing` относится только к **сторонним скриптам** (см. AnalyticsLoader,
 * MarketingLoader). First-party продуктовая телеметрия (UserEvent, POST /api/analytics/events)
 * этим флагам не привязана — см. docs/cookies-and-telemetry.md.
 */
import type { ConsentSnapshot } from "./consent-types";
import { createCookieConsentRunConfig } from "./consent-config";

/** ESM пакет экспортирует именованные функции (run, …), без default — см. dist/cookieconsent.esm.js */
type CookieConsentApi = Pick<
  typeof import("vanilla-cookieconsent"),
  "run" | "validConsent" | "acceptedCategory" | "showPreferences"
>;

type Listener = (state: ConsentSnapshot) => void;

const listeners = new Set<Listener>();

/** Безопасное состояние до инициализации и при отсутствии согласия. */
const DENIED: ConsentSnapshot = {
  necessary: true,
  analytics: false,
  marketing: false,
  hasValidConsent: false,
};

let snapshot: ConsentSnapshot = { ...DENIED };
let initPromise: Promise<void> | null = null;
let initialized = false;

function deriveSnapshot(CC: CookieConsentApi): ConsentSnapshot {
  if (!CC.validConsent()) {
    return { ...DENIED };
  }
  return {
    necessary: true,
    analytics: CC.acceptedCategory("analytics"),
    marketing: CC.acceptedCategory("marketing"),
    hasValidConsent: true,
  };
}

function notify(CC: CookieConsentApi) {
  snapshot = deriveSnapshot(CC);
  for (const fn of listeners) {
    try {
      fn(snapshot);
    } catch {
      /* ignore subscriber errors */
    }
  }
}

export function getConsentSnapshot(): ConsentSnapshot {
  return snapshot;
}

export function subscribeConsent(listener: Listener): () => void {
  listeners.add(listener);
  listener(snapshot);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Однократная инициализация CookieConsent (dynamic import, без SSR).
 * CSS подключается в CookieConsentProvider.
 *
 */
export function initCookieConsent(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const CC = await import("vanilla-cookieconsent");
    if (initialized) return;

    const cfg = createCookieConsentRunConfig(() => {
      notify(CC);
    });

    await CC.run(cfg);
    initialized = true;
    notify(CC);
  })().catch((err) => {
    initPromise = null;
    throw err;
  });

  return initPromise;
}

/**
 * Повторное открытие модалки настроек (футер «Настройки cookies»).
 * Дожидается init, затем CookieConsent.showPreferences().
 */
export function openCookiePreferences(): void {
  if (typeof window === "undefined") return;
  void initCookieConsent().then(async () => {
    const { showPreferences } = await import("vanilla-cookieconsent");
    showPreferences();
  });
}
