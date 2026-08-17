/**
 * Locked retention execution (§21 Step 6, Phases K/O).
 *
 * Same concurrency lesson proven in Steps 3 and 5: retention gets its OWN
 * dedicated GlobalLock connection, never shared with detectors, the
 * snapshot builder, or metric collectors. If the lock can't be acquired
 * (another worker is already running retention), this cycle is skipped
 * cleanly — no DetectorRun, no OperationalSignal, no fake MetricSample.
 *
 * A retention failure is isolated: it's logged and the next scheduled run
 * retries. It must never affect node color, detector scheduling, or
 * collector scheduling — retention is not detector #8.
 */
import type { PrismaClient } from "@prisma/client";
import type { GlobalLock } from "../lock/GlobalLock";
import { runOperationsRetention, type OperationsRetentionResult } from "./runOperationsRetention";

export const RETENTION_LOCK_NAME = "operations.retention";

export interface RetentionRunOutcome {
  /** False when the lock could not be acquired — cycle was skipped. */
  attempted: boolean;
  /** False on an unexpected error during the run. */
  succeeded: boolean;
  result: OperationsRetentionResult | null;
}

export async function runOperationsRetentionWithLock(
  prisma: PrismaClient,
  lock: GlobalLock,
): Promise<RetentionRunOutcome> {
  const acquired = await lock.tryAcquire(RETENTION_LOCK_NAME);
  if (!acquired) {
    return { attempted: false, succeeded: false, result: null };
  }

  try {
    const result = await runOperationsRetention(prisma);
    return { attempted: true, succeeded: true, result };
  } catch (err) {
    console.error(
      `[retention] run failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { attempted: true, succeeded: false, result: null };
  } finally {
    await lock.release(RETENTION_LOCK_NAME);
  }
}
