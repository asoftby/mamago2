/**
 * Lightweight timing utility for profiling server-side pipelines.
 *
 * Usage:
 *   const t = createTimer("import-publish");
 *   // ... do work ...
 *   t.mark("load-record");
 *   // ... more work ...
 *   t.mark("create-activity");
 *   t.end();
 *
 * Output:
 *   [import-publish] step=load-record duration=120ms total=120ms
 *   [import-publish] step=create-activity duration=230ms total=350ms
 *   [import-publish] total=350ms
 */
export function createTimer(scope: string) {
  const started = performance.now();
  let last = started;

  return {
    mark(step: string) {
      const now = performance.now();
      const duration = Math.round(now - last);
      const total = Math.round(now - started);
      console.log(`[${scope}] step=${step} duration=${duration}ms total=${total}ms`);
      last = now;
    },
    end() {
      const now = performance.now();
      const total = Math.round(now - started);
      console.log(`[${scope}] total=${total}ms`);
      return total;
    },
  };
}
