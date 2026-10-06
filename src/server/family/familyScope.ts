import type { Prisma } from "@prisma/client";

/**
 * Family Core B2: pure (no DB) ACL fragments. Ownership comes ONLY from
 * `familyId` (+ `visibility` for plan items). `Child.parentId`,
 * `createdById` and `PlanItem.userId` (except to show a member's own PRIVATE
 * items) are never family ACL.
 *
 * Reads are switched by FAMILY_CORE_READS ("1" | "true"), off by default, so
 * rollback is an env change.
 */
export function familyReadsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = env.FAMILY_CORE_READS?.trim().toLowerCase();
  return v === "1" || v === "true";
}

export type FamilyScope = {
  userId: string;
  familyId: string | null;
  /**
   * Lower bound for shared (FAMILY) plan items: set for a member with
   * historyAccess FROM_JOIN (= their joinedAt). null/undefined = full history.
   * The member's own items are never bounded.
   */
  sharedHistoryFrom?: Date | null;
};

/** Matches no row: user has no active family while family reads are on. */
const NONE = { id: { in: [] as string[] } };

/** FROM_JOIN members see shared history only from the moment they joined. */
export function sharedHistoryFromMembership(membership: {
  historyAccess: "ALL" | "FROM_JOIN";
  joinedAt: Date;
}): Date | null {
  return membership.historyAccess === "FROM_JOIN" ? membership.joinedAt : null;
}

export function planItemScopeWhere(
  scope: FamilyScope,
  familyReads: boolean,
): Prisma.PlanItemWhereInput {
  if (!familyReads) return { userId: scope.userId };
  if (!scope.familyId) return NONE;
  const shared: Prisma.PlanItemWhereInput = scope.sharedHistoryFrom
    ? { visibility: "FAMILY", createdAt: { gte: scope.sharedHistoryFrom } }
    : { visibility: "FAMILY" };
  return {
    familyId: scope.familyId,
    OR: [shared, { userId: scope.userId }],
  };
}

export function childScopeWhere(
  scope: FamilyScope,
  familyReads: boolean,
): Prisma.ChildWhereInput {
  if (!familyReads) return { parentId: scope.userId };
  if (!scope.familyId) return NONE;
  return { familyId: scope.familyId };
}

/** Not-cancelled filter. Replaces `cancelledAt: null` (nothing ever wrote cancelledAt). */
export const NOT_CANCELLED = { status: { not: "CANCELLED" } } as const satisfies Prisma.PlanItemWhereInput;

/** Family invites (M2). Off by default; enabled only after FAMILY_CORE_READS is live on PROD. */
export function familyInvitesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = env.FAMILY_INVITES?.trim().toLowerCase();
  return v === "1" || v === "true";
}
