import "server-only";
import type { ExternalAnalyticsConfig } from "@/lib/analytics/externalAnalyticsTypes";

type EnvLike = Record<string, string | undefined>;

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

/**
 * Resolve public external-analytics configuration from server runtime env.
 *
 * Fail-closed gates:
 * 1. only APP_ENV=production|prod;
 * 2. EXTERNAL_ANALYTICS_ENABLED must be exactly true;
 * 3. each provider needs a valid provider-specific ID.
 *
 * IDs are not secrets, but keeping them server-runtime avoids baking a PROD
 * measurement target into the immutable Next.js client bundle/image.
 */
export function resolveExternalAnalyticsConfig(
  env: EnvLike,
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

export function getExternalAnalyticsConfig(): ExternalAnalyticsConfig {
  return resolveExternalAnalyticsConfig(process.env);
}
