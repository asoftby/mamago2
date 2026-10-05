/**
 * Plan owner abstraction (forward-to-plan spec v1.2, sections 0 and 5).
 *
 * Contract: all capture code (inbox, parser, planEntry.service) receives a
 * `PlanOwner`, never a bare `userId`. Family Core B2: the owner also carries
 * the user's active `familyId` (null until the family exists; the family is
 * created lazily on the first family write). `userId` stays the actor.
 */
export type PlanOwner = {
  userId: string;
  /** undefined = not resolved (flows that never touch Child/PlanItem). */
  familyId?: string | null;
};

export type PlanOwnerDeps = {
  findActiveFamilyId: (userId: string) => Promise<string | null>;
};

async function defaultFindActiveFamilyId(userId: string): Promise<string | null> {
  const [{ prisma }, { findActiveFamilyId }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/server/family/ensureFamily"),
  ]);
  return findActiveFamilyId(prisma, userId);
}

export async function resolvePlanOwner(
  userId: string,
  deps: PlanOwnerDeps = { findActiveFamilyId: defaultFindActiveFamilyId },
): Promise<PlanOwner> {
  return { userId, familyId: await deps.findActiveFamilyId(userId) };
}

/**
 * Owner for flows that only write user-owned inbox data (Telegram capture
 * intake) and never read or write Child/PlanItem: no family lookup, no DB.
 */
export function planOwnerWithoutFamily(userId: string): PlanOwner {
  return { userId };
}
