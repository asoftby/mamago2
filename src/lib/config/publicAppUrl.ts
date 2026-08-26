import { isProductionAppEnv } from "@/lib/config/productionEnvGuard";

const DEFAULT_DEV_PUBLIC_APP_URL = "http://mamago.local:3000";
const DEFAULT_PROD_PUBLIC_APP_URL = "https://mamago.by";

function normalizeUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function stripSurfaceSubdomain(host: string): string {
  return host.replace(/^(admin|business)\./u, "");
}

/**
 * Browser-safe public origin fallback.
 *
 * DEV and PROD intentionally promote the same immutable Docker image, so the
 * public origin must not be baked into NEXT_PUBLIC_APP_URL at build time.
 * Derive it from the current host instead:
 *   admin.dev.mamago.by    -> dev.mamago.by
 *   business.dev.mamago.by -> dev.mamago.by
 *   admin.mamago.by        -> mamago.by
 *   admin.mamago.local     -> mamago.local
 */
export function getBrowserPublicAppUrl(location: {
  protocol: string;
  host: string;
}): string {
  return `${location.protocol}//${stripSurfaceSubdomain(location.host)}`;
}

export function getConfiguredPublicAppUrl(): string | null {
  const raw =
    process.env.APP_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  return raw ? normalizeUrl(raw) : null;
}

export function getCanonicalPublicAppUrl(): string {
  const configured = getConfiguredPublicAppUrl();
  if (configured) return configured;

  if (typeof window !== "undefined") {
    return getBrowserPublicAppUrl(window.location);
  }

  return isProductionAppEnv()
    ? DEFAULT_PROD_PUBLIC_APP_URL
    : DEFAULT_DEV_PUBLIC_APP_URL;
}

export function getDefaultDevPublicAppUrl(): string {
  return DEFAULT_DEV_PUBLIC_APP_URL;
}
