type DiscoveryPerfEnv = {
  APP_ENV?: string;
  NODE_ENV?: string;
  DEBUG_DISCOVERY_PERF?: string;
};

type DiscoveryPerfMetaValue = string | number | boolean | null | undefined;

function normalizeEnv(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

/**
 * Discovery timing logs are a DEV/staging diagnostic only. Production stays
 * disabled even if DEBUG_DISCOVERY_PERF is accidentally set there.
 */
export function isDiscoveryPerfEnabled(
  env: DiscoveryPerfEnv = process.env,
): boolean {
  const appEnv = normalizeEnv(env.APP_ENV);
  if (appEnv === "production" || appEnv === "prod") return false;

  const explicit = normalizeEnv(env.DEBUG_DISCOVERY_PERF);
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
