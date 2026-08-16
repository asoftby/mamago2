/**
 * DetectorRun persistence/execution framework (§21 Step 2, Phase F).
 *
 * These are the primitives future detectors (Step 3+) will run through —
 * no detector exists yet, so in production this executor is simply never
 * invoked (DetectorRegistry is empty). Nothing here fabricates a
 * DetectorRun row to make the table look active.
 */
import type { DetectorRun, PrismaClient } from "@prisma/client";

import type { GlobalLock } from "./lock/GlobalLock";
import { detectorLockName } from "./lock/GlobalLock";
import type { Detector, DetectorContext, DetectorResult } from "./types";

export interface DetectorRunCounts {
  signalsOpened: number;
  signalsResolved: number;
  samplesWritten: number;
}

const ZERO_COUNTS: DetectorRunCounts = { signalsOpened: 0, signalsResolved: 0, samplesWritten: 0 };

export async function startDetectorRun(
  prisma: PrismaClient,
  params: { detector: string; workerId: string },
): Promise<DetectorRun> {
  return prisma.detectorRun.create({
    data: { detector: params.detector, workerId: params.workerId, status: "RUNNING" },
  });
}

export async function markDetectorRunOk(
  prisma: PrismaClient,
  run: DetectorRun,
  counts: DetectorRunCounts = ZERO_COUNTS,
): Promise<DetectorRun> {
  const finishedAt = new Date();
  return prisma.detectorRun.update({
    where: { id: run.id },
    data: {
      status: "OK",
      finishedAt,
      durationMs: finishedAt.getTime() - run.startedAt.getTime(),
      signalsOpened: counts.signalsOpened,
      signalsResolved: counts.signalsResolved,
      samplesWritten: counts.samplesWritten,
    },
  });
}

export async function markDetectorRunFailed(
  prisma: PrismaClient,
  run: DetectorRun,
  error: unknown,
): Promise<DetectorRun> {
  const finishedAt = new Date();
  return prisma.detectorRun.update({
    where: { id: run.id },
    data: {
      status: "FAILED",
      finishedAt,
      durationMs: finishedAt.getTime() - run.startedAt.getTime(),
      error: error instanceof Error ? error.message : String(error),
    },
  });
}

export async function markDetectorRunTimeout(
  prisma: PrismaClient,
  run: DetectorRun,
): Promise<DetectorRun> {
  const finishedAt = new Date();
  return prisma.detectorRun.update({
    where: { id: run.id },
    data: {
      status: "TIMEOUT",
      finishedAt,
      durationMs: finishedAt.getTime() - run.startedAt.getTime(),
    },
  });
}

/** SKIPPED_LOCKED is NOT a successful run — recorded directly, never RUNNING. */
export async function recordDetectorRunSkippedLocked(
  prisma: PrismaClient,
  params: { detector: string; workerId: string },
): Promise<DetectorRun> {
  const now = new Date();
  return prisma.detectorRun.create({
    data: {
      detector: params.detector,
      workerId: params.workerId,
      status: "SKIPPED_LOCKED",
      startedAt: now,
      finishedAt: now,
      durationMs: 0,
    },
  });
}

class DetectorTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new DetectorTimeoutError(`detector timed out after ${timeoutMs}ms`)),
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

export interface ExecuteDetectorDeps<TProbe = unknown> {
  prisma: PrismaClient;
  lock: GlobalLock;
  workerId: string;
  /**
   * Persistence seam: given a successful DetectorResult (and the raw probe
   * value, so e.g. health_endpoint's ReleaseEvent observation can reuse the
   * already-fetched payload instead of a second HTTP call), persist
   * samples/signals and return the counts actually written. When omitted, a
   * successful run always records zero counts, which is honest since
   * nothing was persisted.
   */
  persistResult?: (result: DetectorResult, probe: TProbe) => Promise<DetectorRunCounts>;
}

/**
 * Runs one detector execution: acquire its lock, run probe+evaluate under
 * the detector's timeout, record the outcome as a DetectorRun row. Lock is
 * always released in `finally`.
 */
export async function executeDetector<TProbe>(
  detector: Detector<TProbe>,
  ctx: DetectorContext,
  deps: ExecuteDetectorDeps<TProbe>,
): Promise<DetectorRun> {
  const lockName = detectorLockName(detector.name);
  const acquired = await deps.lock.tryAcquire(lockName);
  if (!acquired) {
    return recordDetectorRunSkippedLocked(deps.prisma, {
      detector: detector.name,
      workerId: deps.workerId,
    });
  }

  try {
    const run = await startDetectorRun(deps.prisma, {
      detector: detector.name,
      workerId: deps.workerId,
    });
    try {
      const probe = await withTimeout(detector.probe(ctx), detector.timeoutMs);
      const result = detector.evaluate(probe);
      const counts = deps.persistResult ? await deps.persistResult(result, probe) : ZERO_COUNTS;
      return await markDetectorRunOk(deps.prisma, run, counts);
    } catch (err) {
      if (err instanceof DetectorTimeoutError) {
        return await markDetectorRunTimeout(deps.prisma, run);
      }
      return await markDetectorRunFailed(deps.prisma, run, err);
    }
  } finally {
    await deps.lock.release(lockName);
  }
}
