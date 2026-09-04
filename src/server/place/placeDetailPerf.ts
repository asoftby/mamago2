type PlaceDetailPerfEnv = {
  APP_ENV?: string;
  NODE_ENV?: string;
  DEBUG_PLACE_DETAIL_PERF?: string;
};

type PlaceDetailPerfMetaValue = string | number | boolean | null | undefined;

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
 * Place detail timing logs are diagnostics for recognized non-PROD
 * environments only. Production fails closed even when APP_ENV is missing or
 * DEBUG_PLACE_DETAIL_PERF=true is accidentally retained.
 */
export function isPlaceDetailPerfEnabled(
  env: PlaceDetailPerfEnv = process.env,
): boolean {
  const appEnv = normalizeEnv(env.APP_ENV);
  const nodeEnv = normalizeEnv(env.NODE_ENV);
  const explicit = normalizeEnv(env.DEBUG_PLACE_DETAIL_PERF);

  if (appEnv === "production" || appEnv === "prod") return false;

  if (NON_PRODUCTION_APP_ENVS.has(appEnv)) {
    return explicit !== "false";
  }

  // Current PROD can run without APP_ENV=production. Never let a debug flag
  // override NODE_ENV=production unless APP_ENV explicitly identified a known
  // non-production environment above.
  if (nodeEnv === "production") return false;

  if (!appEnv) {
    if (explicit === "false") return false;
    return true;
  }

  // Unknown APP_ENV values fail closed rather than silently enabling logging.
  return false;
}

export function createPlaceDetailPerf(scope: string) {
  const enabled = isPlaceDetailPerfEnabled();
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

    log(meta?: Record<string, PlaceDetailPerfMetaValue>) {
      if (!enabled) return 0;
      const totalMs = Math.round(performance.now() - started);
      const parts = durations.map(({ step, durationMs }) => `${step}=${durationMs}ms`);
      parts.push(`total=${totalMs}ms`);

      if (meta) {
        for (const [key, value] of Object.entries(meta)) {
          if (value !== undefined) parts.push(`${key}=${value}`);
        }
      }

      console.info(`[place-detail-perf:${scope}] ${parts.join(" ")}`);
      return totalMs;
    },
  };
}
