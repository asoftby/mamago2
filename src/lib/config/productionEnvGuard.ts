function readBooleanEnv(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === "true";
}

export function isProductionAppEnv(): boolean {
  const appEnv = process.env.APP_ENV?.trim().toLowerCase();
  return appEnv === "production" || appEnv === "prod";
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
