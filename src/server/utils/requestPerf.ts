const SERVER_DEBUG_SAVE_PERF =
  process.env.NODE_ENV !== "production" || process.env.DEBUG_SAVE_PERF === "true";

type PerfMetaValue = string | number | boolean | null | undefined;

export function isServerSavePerfEnabled(): boolean {
  return SERVER_DEBUG_SAVE_PERF;
}

export function createRequestPerf(scope: string) {
  const enabled = isServerSavePerfEnabled();
  const started = enabled ? performance.now() : 0;
  let last = started;
  const durations: Record<string, number> = {};

  return {
    mark(step: string) {
      if (!enabled) return;
      const now = performance.now();
      durations[step] = Math.round((durations[step] ?? 0) + (now - last));
      last = now;
    },
    log(meta?: Record<string, PerfMetaValue>) {
      if (!enabled) return 0;
      const total = Math.round(performance.now() - started);
      const parts = Object.entries(durations)
        .map(([step, duration]) => `${step}=${duration}ms`)
        .sort();

      parts.push(`total=${total}ms`);

      if (meta) {
        for (const [key, value] of Object.entries(meta)) {
          if (value !== undefined) {
            parts.push(`${key}=${value}`);
          }
        }
      }

      console.log(`[${scope}] ${parts.join(" ")}`);
      return total;
    },
  };
}
