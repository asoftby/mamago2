import type { ExternalAnalyticsConfig } from "@/lib/analytics/externalAnalyticsTypes";

export type ExternalAnalyticsEnv = Record<string, string | undefined>;

function isProdAppEnv(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "production" || normalized === "prod";
}

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function parseGoogleAnalyticsId(value: string | undefined): string | null {
  const id = value?.trim().toUpperCase() ?? "";
  return /^G-[A-Z0-9]+$/.test(id) ? id : null;
}

function parseYandexMetrikaId(value: string | undefined): number | null {
  const raw = value?.trim() ?? "";
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Pure fail-closed resolver; server runtime env is supplied by the caller. */
export function resolveExternalAnalyticsConfig(
  env: ExternalAnalyticsEnv,
): ExternalAnalyticsConfig {
  const enabled =
    isProdAppEnv(env.APP_ENV) && isEnabled(env.EXTERNAL_ANALYTICS_ENABLED);

  if (!enabled) {
    return {
      enabled: false,
      googleAnalyticsId: null,
      yandexMetrikaId: null,
    };
  }

  return {
    enabled: true,
    googleAnalyticsId: parseGoogleAnalyticsId(env.GOOGLE_ANALYTICS_ID),
    yandexMetrikaId: parseYandexMetrikaId(env.YANDEX_METRIKA_ID),
  };
}
