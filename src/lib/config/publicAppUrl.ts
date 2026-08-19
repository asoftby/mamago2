import { isProductionAppEnv } from "@/lib/config/productionEnvGuard";

const DEFAULT_DEV_PUBLIC_APP_URL = "http://mamago.local:3000";
const DEFAULT_PROD_PUBLIC_APP_URL = "https://mamago.by";

function normalizeUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

export function getConfiguredPublicAppUrl(): string | null {
  const raw =
    process.env.APP_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  return raw ? normalizeUrl(raw) : null;
}

export function getCanonicalPublicAppUrl(): string {
  return (
    getConfiguredPublicAppUrl() ||
    (isProductionAppEnv() ? DEFAULT_PROD_PUBLIC_APP_URL : DEFAULT_DEV_PUBLIC_APP_URL)
  );
}

export function getDefaultDevPublicAppUrl(): string {
  return DEFAULT_DEV_PUBLIC_APP_URL;
}
