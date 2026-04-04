"use client";

/**
 * Клиент для first-party **продуктовой телеметрии**: события уходят на POST /api/analytics/events
 * и пишутся в нашу БД (UserEvent). Это не «analytics cookies» в смысле баннера согласия:
 * переключатель «Внешняя веб-аналитика» управляет только сторонними скриптами (GA, PostHog, …).
 *
 * Имя `postAnalyticsEvent` историческое; предпочтительный алиас для нового кода — postProductTelemetryEvent.
 * См. docs/cookies-and-telemetry.md.
 */

import type { TrackUserEventInput } from "@/lib/analytics/types";

const STORAGE_KEY = "mg_analytics_sid";

function getOrCreateClientSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `s_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
      window.localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

/**
 * Отправка события продуктовой телеметрии с клиента (CARD_VIEW, CTA_CLICK и т.д.).
 * Не бросает — ошибки только в console.debug.
 */
export async function postAnalyticsEvent(
  input: TrackUserEventInput,
): Promise<void> {
  try {
    const clientSid = getOrCreateClientSessionId();
    const res = await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        ...input,
        sessionId: input.sessionId ?? (clientSid || undefined),
      }),
    });
    if (!res.ok) {
      console.debug("[product-telemetry] postAnalyticsEvent", res.status);
    }
  } catch (e) {
    console.debug("[product-telemetry] postAnalyticsEvent failed", e);
  }
}

/** Семантически то же, что postAnalyticsEvent (first-party product telemetry). */
export const postProductTelemetryEvent = postAnalyticsEvent;
