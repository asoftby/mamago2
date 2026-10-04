import { Prisma, type PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Family Core B1: returns the id of the user's active family, creating a
 * single-adult family (user = OWNER, historyAccess ALL) when none exists.
 *
 * Concurrency: the partial unique index `FamilyMembership_active_user` makes
 * the second concurrent creator fail with P2002; that creator rolls back its
 * own transaction (no orphan Family) and re-reads the winner's family.
 *
 * Not wired into any request path in B1 (production reads/writes are not
 * switched until B2). Does not touch tombstones: callers must not pass a
 * deleted user.
 */
export async function ensureFamilyForUser(
  prisma: PrismaClient,
  userId: string,
): Promise<string> {
  const existing = await findActiveFamilyId(prisma, userId);
  if (existing) return existing;
  try {
    return await prisma.$transaction(async (tx) => {
      const family = await tx.family.create({ data: {} });
      await tx.familyMembership.create({
        data: { familyId: family.id, userId, role: "OWNER", historyAccess: "ALL" },
      });
      return family.id;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await findActiveFamilyId(prisma, userId);
      if (winner) return winner;
    }
    throw error;
  }
}

export async function findActiveFamilyId(db: Db, userId: string): Promise<string | null> {
  const membership = await db.familyMembership.findFirst({
    where: { userId, leftAt: null },
    select: { familyId: true },
  });
  return membership?.familyId ?? null;
}
