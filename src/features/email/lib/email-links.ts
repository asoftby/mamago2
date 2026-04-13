import { getConfiguredPublicAppUrl, getDefaultDevPublicAppUrl } from "@/lib/config/publicAppUrl";

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

/**
 * Базовый публичный URL приложения (без завершающего слэша).
 * @throws если не задан ни APP_PUBLIC_URL, ни NEXT_PUBLIC_APP_URL
 */
export function getPublicAppUrl(): string {
  const raw = getConfiguredPublicAppUrl();
  if (!raw) {
    throw new Error(
      `APP_PUBLIC_URL не задан. Укажите публичный URL приложения (для ссылок в письмах). Для локальной разработки используйте ${getDefaultDevPublicAppUrl()} или задайте NEXT_PUBLIC_APP_URL.`,
    );
  }
  return normalizeBaseUrl(raw);
}

export function buildVerifyEmailUrl(token: string): string {
  return `${getPublicAppUrl()}/api/auth/verify-email/${encodeURIComponent(token)}`;
}

export function buildPasswordResetUrl(token: string): string {
  return `${getPublicAppUrl()}/reset-password/${encodeURIComponent(token)}`;
}
