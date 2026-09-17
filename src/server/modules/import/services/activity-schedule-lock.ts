import type { Prisma } from "@prisma/client";

type ActivityScheduleLockClient = Pick<Prisma.TransactionClient, "$queryRaw">;

export function activityScheduleLockKey(activityId: string): string {
  return `mamago:activity-schedule:${activityId}`;
}

/**
 * Serialize all import/manual ownership changes for one Activity schedule.
 * Every writer that can mutate imported ActivitySession ownership must take
 * this lock inside its transaction before reading or writing schedule state.
 */
export async function acquireActivityScheduleLock(
  tx: ActivityScheduleLockClient,
  activityId: string,
): Promise<void> {
  const key = activityScheduleLockKey(activityId);
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
