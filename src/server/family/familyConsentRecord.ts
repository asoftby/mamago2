import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Persists the joiner's FAMILY_SHARED_DATA consent for a family. Idempotent:
 * an existing unrevoked record for the same user, family and text version is
 * reused, so the preview step (first disclosure of family data) and the accept
 * step share one record.
 */
export async function recordFamilySharedDataConsent(
  db: Db,
  input: { userId: string; familyId: string; textVersion: string; now: Date },
): Promise<{ id: string }> {
  const textVersion = input.textVersion.trim();
  const existing = await db.consentRecord.findFirst({
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
  return db.consentRecord.create({
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
