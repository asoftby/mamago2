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
  | "run"
  | "validConsent"
  | "acceptedCategory"
  | "acceptCategory"
  | "showPreferences"
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

/** Однократная инициализация CookieConsent (dynamic import, без SSR). */
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

/** Повторное открытие модалки настроек (футер «Настройки cookies»). */
export function openCookiePreferences(): void {
  if (typeof window === "undefined") return;
  void openCookiePreferencesFromShell().catch((err) => {
    console.error("[CookieConsent] preferences failed", err);
  });
}

/** Consent is still recorded only by vanilla-cookieconsent itself. */
export async function acceptFromShell(categories: "all" | []): Promise<void> {
  await initCookieConsent();
  const CC = await import("vanilla-cookieconsent");
  CC.acceptCategory(categories);
  notify(CC);
}

/**
 * Opens preferences only after an explicit user action. The shell caller may
 * unmount only after the library has rendered and exposed the preferences UI.
 */
export async function openCookiePreferencesFromShell(): Promise<void> {
  if (typeof window === "undefined") return;

  await initCookieConsent();
  const { showPreferences } = await import("vanilla-cookieconsent");
  showPreferences();

  await new Promise<void>((resolve) =>
    window.requestAnimationFrame(() => resolve()),
  );

  const preferences = document.querySelector<HTMLElement>("#cc-main .pm");
  const isVisible =
    document.documentElement.classList.contains("show--preferences") &&
    preferences !== null &&
    window.getComputedStyle(preferences).visibility !== "hidden";

  if (!isVisible) {
    throw new Error("Cookie preferences modal did not become visible");
  }
}
