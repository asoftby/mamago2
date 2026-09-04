type PlaceDetailPerfEnv = {
  APP_ENV?: string;
  NODE_ENV?: string;
  DEBUG_PLACE_DETAIL_PERF?: string;
};

type PlaceDetailPerfMetaValue = string | number | boolean | null | undefined;

function normalizeEnv(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

/**
 * Place detail timing logs are diagnostics for non-PROD environments only.
 * Deployed DEV uses `next start`, so NODE_ENV alone cannot distinguish DEV
 * from PROD; APP_ENV remains the primary safety boundary.
 */
export function isPlaceDetailPerfEnabled(
  env: PlaceDetailPerfEnv = process.env,
): boolean {
  const appEnv = normalizeEnv(env.APP_ENV);
  if (appEnv === "production" || appEnv === "prod") return false;

  const explicit = normalizeEnv(env.DEBUG_PLACE_DETAIL_PERF);
  if (explicit === "false") return false;
  if (explicit === "true") return true;

  if (
    appEnv === "dev" ||
    appEnv === "development" ||
    appEnv === "staging" ||
    appEnv === "preview" ||
    appEnv === "local"
  ) {
    return true;
  }

  return !appEnv && env.NODE_ENV !== "production";
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
