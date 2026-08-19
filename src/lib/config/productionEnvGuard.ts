function readBooleanEnv(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === "true";
}

export function isProductionAppEnv(): boolean {
  const appEnv = process.env.APP_ENV?.trim().toLowerCase();
  return appEnv === "production" || appEnv === "prod";
}

/**
 * Laptop / tunnel development — not a deployed host.
 *
 * `next start` sets NODE_ENV=production even on DEV images, so NODE_ENV
 * must never be the deployment selector. Explicit APP_ENV=dev|staging|preview
 * means a deployed non-PROD host. APP_ENV=local is always local.
 * Unset APP_ENV with NODE_ENV=development is local `next dev`.
 */
export function isLocalAppEnv(): boolean {
  const appEnv = process.env.APP_ENV?.trim().toLowerCase() ?? "";
  if (appEnv === "local") return true;
  if (isProductionAppEnv()) return false;
  if (appEnv === "dev" || appEnv === "development" || appEnv === "staging" || appEnv === "preview") {
    return false;
  }
  return process.env.NODE_ENV !== "production";
}

/**
 * Warn or fail when production is configured to block search indexing accidentally.
 * Staging/dev may keep SITE_NOINDEX_DEFAULT=true.
 */
export function assertProductionSeoEnv(): void {
  if (!isProductionAppEnv()) {
    return;
  }

  if (readBooleanEnv("SITE_NOINDEX_FORCE")) {
    console.error(
      "[env] SITE_NOINDEX_FORCE=true in APP_ENV=production — site is fully noindexed.",
    );
    return;
  }

  if (readBooleanEnv("SITE_NOINDEX_DEFAULT")) {
    throw new Error(
      "SITE_NOINDEX_DEFAULT=true with APP_ENV=production blocks search indexing. " +
        "Set SITE_NOINDEX_DEFAULT=false before production launch.",
    );
  }
}
