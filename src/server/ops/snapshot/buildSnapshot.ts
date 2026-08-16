/**
 * Singleton OperationsSnapshot builder (§21 Step 2, Phases I/J/K).
 *
 * CRITICAL LOCK ORDER: the `operations.snapshot_builder` advisory lock is
 * acquired BEFORE data collection and held through the entire
 * collection+write cycle, released only in `finally` — never acquired
 * just-in-time before the INSERT.
 *
 * Time semantics (frozen, do not blur):
 *   startedAt   = DB time at the START of collection (content-order key —
 *                 the monotonicity guarantee is keyed on this, never on
 *                 process `new Date()`).
 *   generatedAt = DB time of a successful write (freshness/liveness only).
 *   completedAt = DB time the build finished.
 */
import type { PrismaClient } from "@prisma/client";

import { getDbNow } from "../dbTime";
import { GlobalLock, SNAPSHOT_BUILDER_LOCK_NAME } from "../lock/GlobalLock";
import { collectSnapshotPayload, type OperationsSnapshotPayload } from "./payload";

export interface BuildSnapshotDeps {
  prisma: PrismaClient;
  lock: GlobalLock;
}

export interface BuildSnapshotResult {
  /** False when the builder lock could not be acquired — cycle was skipped. */
  attempted: boolean;
  /**
   * True when this build's payload was actually written. False when the
   * lock was acquired but the monotonic upsert rejected the write because
   * a newer startedAt already exists (should not normally happen under a
   * single-owner lock, but the guarantee holds regardless).
   */
  accepted: boolean;
}

/**
 * Monotonic singleton upsert: a write is only accepted if its startedAt is
 * strictly newer than the currently stored row's startedAt. This is the
 * exact mechanism the 1.2 -> 1.2.1 architecture-freeze hotfix requires —
 * comparing generatedAt instead would let an old payload overwrite a newer
 * one, since generatedAt is assigned at write time, not content time.
 */
export async function upsertSnapshotMonotonic(
  prisma: PrismaClient,
  params: { startedAt: Date; payload: OperationsSnapshotPayload },
): Promise<{ accepted: boolean }> {
  const affected = await prisma.$executeRaw`
    INSERT INTO "OperationsSnapshot"
      ("id", "generatedAt", "startedAt", "completedAt", "payload")
    VALUES (
      'current',
      clock_timestamp(),
      ${params.startedAt},
      clock_timestamp(),
      ${JSON.stringify(params.payload)}::jsonb
    )
    ON CONFLICT ("id") DO UPDATE
    SET
      "generatedAt" = EXCLUDED."generatedAt",
      "startedAt"   = EXCLUDED."startedAt",
      "completedAt" = EXCLUDED."completedAt",
      "payload"     = EXCLUDED."payload"
    WHERE
      "OperationsSnapshot"."startedAt" < EXCLUDED."startedAt"
  `;
  return { accepted: affected > 0 };
}

export async function buildSnapshot(deps: BuildSnapshotDeps): Promise<BuildSnapshotResult> {
  const acquired = await deps.lock.tryAcquire(SNAPSHOT_BUILDER_LOCK_NAME);
  if (!acquired) {
    return { attempted: false, accepted: false };
  }

  try {
    const startedAt = await getDbNow(deps.prisma);
    const payload = collectSnapshotPayload();
    const { accepted } = await upsertSnapshotMonotonic(deps.prisma, { startedAt, payload });
    return { attempted: true, accepted };
  } finally {
    await deps.lock.release(SNAPSHOT_BUILDER_LOCK_NAME);
  }
}
