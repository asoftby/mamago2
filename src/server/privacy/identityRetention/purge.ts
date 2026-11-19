import type { PrismaClient } from "@prisma/client";

/**
 * Deletes identity-retention records whose one-year term (постановление № 850)
 * has passed. Idempotent; uses the purgeAfter index; returns only a count.
 */
export async function purgeExpiredIdentityRecords(options: {
  db: Pick<PrismaClient, "identityRetentionRecord">;
  now?: Date;
}): Promise<{ deleted: number }> {
  const now = options.now ?? new Date();
  const result = await options.db.identityRetentionRecord.deleteMany({ where: { purgeAfter: { lte: now } } });
  return { deleted: result.count };
}
