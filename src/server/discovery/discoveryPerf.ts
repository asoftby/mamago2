type DiscoveryPerfEnv = {
  APP_ENV?: string;
  NODE_ENV?: string;
  DEBUG_DISCOVERY_PERF?: string;
};

type DiscoveryPerfMetaValue = string | number | boolean | null | undefined;

function normalizeEnv(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

const NON_PRODUCTION_APP_ENVS = new Set([
  "dev",
  "development",
  "staging",
  "preview",
  "local",
]);

/**
 * Discovery timing logs are diagnostics for recognized non-PROD environments
 * only. Production fails closed even when APP_ENV is missing or
 * DEBUG_DISCOVERY_PERF=true is accidentally retained.
 */
export function isDiscoveryPerfEnabled(
  env: DiscoveryPerfEnv = process.env,
): boolean {
  const appEnv = normalizeEnv(env.APP_ENV);
  const nodeEnv = normalizeEnv(env.NODE_ENV);
  const explicit = normalizeEnv(env.DEBUG_DISCOVERY_PERF);

  if (appEnv === "production" || appEnv === "prod") return false;

  if (NON_PRODUCTION_APP_ENVS.has(appEnv)) {
    return explicit !== "false";
  }

  // Current PROD can run without APP_ENV=production. A retained debug flag
  // must never override NODE_ENV=production unless APP_ENV explicitly identifies
  // a known non-production environment above.
  if (nodeEnv === "production") return false;

  if (!appEnv) {
    if (explicit === "false") return false;
    return true;
  }

  // Unknown APP_ENV values fail closed.
  return false;
}

export function createDiscoveryPerf(scope: string) {
  const enabled = isDiscoveryPerfEnabled();
  const started = enabled ? performance.now() : 0;
  let last = started;
  const durations: Array<{ step: string; durationMs: number }> = [];

  return {
    mark(step: string) {
      if (!enabled) return;
      const now = performance.now();
      durations.push({ step, durationMs: Math.round(now - last) });
      last = now;
    },

    log(meta?: Record<string, DiscoveryPerfMetaValue>) {
      if (!enabled) return 0;
      const totalMs = Math.round(performance.now() - started);
      const parts = durations.map(({ step, durationMs }) => `${step}=${durationMs}ms`);
      parts.push(`total=${totalMs}ms`);

      if (meta) {
        for (const [key, value] of Object.entries(meta)) {
          if (value !== undefined) parts.push(`${key}=${value}`);
        }
      }

      console.info(`[discovery-perf:${scope}] ${parts.join(" ")}`);
      return totalMs;
    },
  };
}
