/**
 * Generic interval-based scheduling infrastructure (§21 Step 2, Phase H).
 *
 * setInterval-based, one timer per named task — not per database row, not
 * a busy loop. Overlapping ticks are skipped (never runs the same task
 * concurrently with itself) rather than queued, so a slow run just delays
 * the next tick's effect instead of piling up.
 */

export interface ScheduledTask {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
  /** Run once immediately in addition to the first interval tick. Default: true. */
  runImmediately?: boolean;
}

export class Scheduler {
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly running = new Set<string>();
  private stopped = false;

  scheduleRepeating(task: ScheduledTask): void {
    if (this.stopped) return;
    if (this.timers.has(task.name)) {
      throw new Error(`Task "${task.name}" is already scheduled`);
    }

    const tick = async () => {
      if (this.stopped) return;
      if (this.running.has(task.name)) {
        // Previous run still in flight — skip this tick, never overlap.
        return;
      }
      this.running.add(task.name);
      try {
        await task.run();
      } catch (err) {
        console.error(`[worker] scheduled task "${task.name}" failed:`, err);
      } finally {
        this.running.delete(task.name);
      }
    };

    const timer = setInterval(() => void tick(), task.intervalMs);
    this.timers.set(task.name, timer);

    if (task.runImmediately !== false) {
      void tick();
    }
  }

  stop(): void {
    this.stopped = true;
    for (const timer of this.timers.values()) clearInterval(timer);
    this.timers.clear();
  }
}
