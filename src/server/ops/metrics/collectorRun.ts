/**
 * MetricCollector execution (§21 Step 5, Phases B/K/M).
 *
 * Same concurrency lesson already proven in Step 3: each scheduled
 * collector task gets its OWN dedicated GlobalLock connection (never
 * shared with a concurrently-running task on one pg.Client).
 *
 * UNKNOWN != ZERO: a collector exception or timeout writes NO samples —
 * never a synthesized zero. No OperationalSignal, no DetectorRun; a
 * failure is only ever logged.
 */
import { getDbNow } from "../dbTime";
import type { GlobalLock } from "../lock/GlobalLock";
import type { MetricCollector, MetricSampleDraft } from "./types";

export const METRIC_COLLECTOR_LOCK_PREFIX = "metric_collector:";

export function metricCollectorLockName(name: string): string {
  return `${METRIC_COLLECTOR_LOCK_PREFIX}${name}`;
}

class MetricCollectorTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new MetricCollectorTimeoutError(`metric collector timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export interface RunMetricCollectorDeps {
  prisma: import("@prisma/client").PrismaClient;
  lock: GlobalLock;
}

export interface MetricCollectorRunResult {
  /** False when the collector's lock could not be acquired — cycle was skipped. */
  attempted: boolean;
  /** False on exception/timeout — no samples were written for this cycle. */
  succeeded: boolean;
  samplesWritten: number;
}

export async function runMetricCollector(
  collector: MetricCollector,
  deps: RunMetricCollectorDeps,
): Promise<MetricCollectorRunResult> {
  const lockName = metricCollectorLockName(collector.name);
  const acquired = await deps.lock.tryAcquire(lockName);
  if (!acquired) {
    return { attempted: false, succeeded: false, samplesWritten: 0 };
  }

  try {
    const now = await getDbNow(deps.prisma);

    let drafts: MetricSampleDraft[];
    try {
      drafts = await withTimeout(collector.collect({ prisma: deps.prisma, now }), collector.timeoutMs);
    } catch (err) {
      console.error(
        `[metrics] collector "${collector.name}" failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { attempted: true, succeeded: false, samplesWritten: 0 };
    }

    if (drafts.length === 0) {
      // Legitimate: e.g. a ratio skipped because its denominator was zero.
      return { attempted: true, succeeded: true, samplesWritten: 0 };
    }

    // A single INSERT ... VALUES (...), (...) is atomic by construction —
    // no explicit transaction wrapper needed for "all or nothing".
    await deps.prisma.metricSample.createMany({
      data: drafts.map((draft) => ({
        metric: draft.metric,
        dimKey: draft.dimKey ?? "",
        value: draft.value,
        collectedAt: now,
      })),
    });

    return { attempted: true, succeeded: true, samplesWritten: drafts.length };
  } finally {
    await deps.lock.release(lockName);
  }
}
