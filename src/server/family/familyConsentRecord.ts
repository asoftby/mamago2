import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;
type Input = { userId: string; familyId: string; textVersion: string; now: Date };

export function familyConsentLockKey(userId: string, familyId: string): string {
  return `mamago:family-consent:${userId}:${familyId}`;
}

async function recordInTx(tx: Prisma.TransactionClient, input: Input): Promise<{ id: string }> {
  // Serialize check-and-create per (user, family): concurrent previews, or a
  // preview racing accept, must not insert duplicate consent rows.
  // pg_advisory_xact_lock returns `void`, which Prisma 7 cannot deserialize,
  // so a scalar is projected while the lock function runs in FROM.
  const key = familyConsentLockKey(input.userId, input.familyId);
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  const textVersion = input.textVersion.trim();
  const existing = await tx.consentRecord.findFirst({
    where: {
      userId: input.userId,
      familyId: input.familyId,
      type: "FAMILY_SHARED_DATA",
      textVersion,
      revokedAt: null,
    },
    select: { id: true },
  });
  if (existing) return existing;
  return tx.consentRecord.create({
    data: {
      userId: input.userId,
      familyId: input.familyId,
      type: "FAMILY_SHARED_DATA",
      textVersion,
      acceptedAt: input.now,
    },
    select: { id: true },
  });
}

/**
 * Persists the joiner's FAMILY_SHARED_DATA consent for a family. Idempotent and
 * concurrency-safe: an existing unrevoked record for the same user, family and
 * text version is reused, so the preview step (first disclosure of family data)
 * and the accept step share one record. Inside a transaction the lock is held
 * until that transaction ends; with a plain client a short transaction is used.
 */
export async function recordFamilySharedDataConsent(db: Db, input: Input): Promise<{ id: string }> {
  if ("$transaction" in db) return db.$transaction((tx) => recordInTx(tx, input));
  return recordInTx(db, input);
}
