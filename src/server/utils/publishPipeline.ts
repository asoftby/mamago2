type PublishStep =
  | "validate"
  | "db"
  | "media"
  | "status"
  | "revalidate"
  | "notifications"
  | "response";

type PublishDurations = Partial<Record<PublishStep, number>>;

const DEBUG_PUBLISH_PERF =
  process.env.NODE_ENV !== "production" || process.env.DEBUG_SAVE_PERF === "true";

export function createPublishTimer(scope: string) {
  const started = DEBUG_PUBLISH_PERF ? performance.now() : 0;
  let last = started;
  const durations: PublishDurations = {};

  return {
    mark(step: PublishStep) {
      if (!DEBUG_PUBLISH_PERF) return;
      const now = performance.now();
      durations[step] = (durations[step] ?? 0) + Math.round(now - last);
      last = now;
    },
    log(extra?: Record<string, string | number | null | undefined>) {
      if (!DEBUG_PUBLISH_PERF) return 0;
      const total = Math.round(performance.now() - started);
      const parts = [
        `validate=${durations.validate ?? 0}ms`,
        `db=${durations.db ?? 0}ms`,
        `media=${durations.media ?? 0}ms`,
        `status=${durations.status ?? 0}ms`,
        `revalidate=${durations.revalidate ?? 0}ms`,
        `notifications=${durations.notifications ?? 0}ms`,
        `total=${total}ms`,
      ];

      if (extra) {
        for (const [key, value] of Object.entries(extra)) {
          if (value !== undefined) parts.push(`${key}=${value}`);
        }
      }

      console.log(`[${scope}] ${parts.join(" ")}`);
      return total;
    },
  };
}

export function runAfterPublishResponse(
  scope: string,
  taskName: string,
  task: () => Promise<unknown> | unknown,
): void {
  void Promise.resolve()
    .then(task)
    .catch((error) => {
      console.error(`[${scope}] ${taskName} failed:`, error);
    });
}
