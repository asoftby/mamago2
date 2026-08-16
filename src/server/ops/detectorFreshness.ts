/**
 * Shared detector-freshness computation (§21 Step 3, Phases F/H).
 *
 * Used by BOTH:
 *  - detector_stale's evaluate() (decides whether to emit a CRITICAL signal)
 *  - the snapshot builder's node projection (decides NO_DATA)
 *
 * "Stale" covers two distinct conditions the frozen contract lists
 * together: the detector has NEVER successfully run, or its last
 * successful run is older than 3x its interval. Cold-start grace only
 * suppresses the detector_stale CRITICAL *signal* for a never-yet-run
 * detector during the first 3x interval after worker start — it does NOT
 * make the node any less NO_DATA, since "never ran" is already sufficient
 * for NO_DATA on its own.
 */

export interface DetectorFreshnessInput {
  intervalSec: number;
  /** Most recent DetectorRun with status=OK for this detector, or null if none exists. */
  lastOkAt: Date | null;
  /** DB-observed current time. */
  now: Date;
  /** DB-derived worker start time (Step 2 WorkerContext.workerStartedAt). */
  workerStartedAt: Date;
}

export interface DetectorFreshnessResult {
  /** True if the detector never ran OK, or its last OK run exceeds 3x interval. */
  isStale: boolean;
  /**
   * True only while lastOkAt is null AND we're still within
   * workerStartedAt + 3x interval — suppresses detector_stale's CRITICAL
   * signal for a detector that simply hasn't had its first legitimate
   * chance to run yet.
   */
  inColdStartGrace: boolean;
}

export function computeDetectorFreshness(input: DetectorFreshnessInput): DetectorFreshnessResult {
  const thresholdMs = 3 * input.intervalSec * 1000;

  if (input.lastOkAt === null) {
    const graceUntil = input.workerStartedAt.getTime() + thresholdMs;
    return { isStale: true, inColdStartGrace: input.now.getTime() < graceUntil };
  }

  const ageMs = input.now.getTime() - input.lastOkAt.getTime();
  return { isStale: ageMs > thresholdMs, inColdStartGrace: false };
}
