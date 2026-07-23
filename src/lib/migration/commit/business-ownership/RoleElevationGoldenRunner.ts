import { Prisma, PrismaClient } from "@prisma/client";

import { BUSINESS_OWNERSHIP_SOURCE_NAMESPACE } from "./BusinessOwnershipGoldenRunner";

/**
 * USERS Slice 9 golden proof: exactly one privilege-elevation write —
 * `wordpress-db:user:38`, USER -> BUSINESS_OWNER — for a User whose
 * Business and Place-ownership link were already written in Slice 7.
 * This module changes exactly one field (`User.role`). It never touches
 * `status`, `passwordHash`, `emailVerifiedAt`, sessions, action tokens, the
 * Business row, the Place row, or any MigrationLineage — those were
 * already correct before this slice and stay untouched.
 *
 * Deliberately not generalised to a batch runner: elevating the other 35
 * newly-owned Businesses' owners is a separate, explicitly authorized
 * future slice, once this single write path is proven.
 */

export type RoleElevationAction = "ELEVATE" | "SKIP_UNCHANGED" | "BLOCKED";

export type RoleElevationReason =
  | "USER_LINEAGE_MISSING"
  | "BUSINESS_LINEAGE_MISSING"
  | "BUSINESS_OWNER_MISMATCH"
  | "PLACE_OWNERSHIP_NOT_LINKED"
  | "TARGET_USER_ROLE_NOT_ELIGIBLE";

export interface RoleElevationGoldenCandidate {
  /** e.g. "wordpress-db:user:38" */
  sourceRecordKey: string;
}

export interface RoleElevationGoldenPlan {
  candidate: RoleElevationGoldenCandidate;
  action: RoleElevationAction;
  reason: RoleElevationReason | null;
  targetUserId: string | null;
  businessId: string | null;
  linkedPlaceIds: readonly string[];
}

export interface RoleElevationGoldenWriteResult {
  action: RoleElevationAction;
  targetUserId: string | null;
}

/**
 * Read-only reconciliation: confirms the User was already elevated to
 * BUSINESS_OWNER-eligible state by a prior ownership write (User lineage,
 * Business lineage, Business.ownerUserId match, at least one linked
 * Place), then classifies ELEVATE / SKIP_UNCHANGED / BLOCKED. Performs no
 * writes.
 */
export async function planRoleElevationGolden(
  prisma: PrismaClient,
  candidate: RoleElevationGoldenCandidate,
  sourceNamespace = BUSINESS_OWNERSHIP_SOURCE_NAMESPACE,
): Promise<RoleElevationGoldenPlan> {
  const source = await prisma.migrationSource.findUnique({ where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace } } });

  const userLineage = source
    ? await prisma.migrationLineage.findUnique({
        where: { sourceId_sourceRecordKey_targetType_targetRole: { sourceId: source.id, sourceRecordKey: candidate.sourceRecordKey, targetType: "USER", targetRole: "primary" } },
      })
    : null;
  if (!userLineage?.isActive || !userLineage.targetId) {
    return { candidate, action: "BLOCKED", reason: "USER_LINEAGE_MISSING", targetUserId: null, businessId: null, linkedPlaceIds: [] };
  }
  const targetUserId = userLineage.targetId;

  const businessLineage = source
    ? await prisma.migrationLineage.findUnique({
        where: { sourceId_sourceRecordKey_targetType_targetRole: { sourceId: source.id, sourceRecordKey: candidate.sourceRecordKey, targetType: "BUSINESS", targetRole: "primary" } },
      })
    : null;
  if (!businessLineage?.isActive || !businessLineage.targetId) {
    return { candidate, action: "BLOCKED", reason: "BUSINESS_LINEAGE_MISSING", targetUserId, businessId: null, linkedPlaceIds: [] };
  }
  const businessId = businessLineage.targetId;

  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { ownerUserId: true } });
  if (business.ownerUserId !== targetUserId) {
    return { candidate, action: "BLOCKED", reason: "BUSINESS_OWNER_MISMATCH", targetUserId, businessId, linkedPlaceIds: [] };
  }

  const linkedPlaces = await prisma.place.findMany({ where: { ownerBusinessId: businessId }, select: { id: true } });
  if (linkedPlaces.length === 0) {
    return { candidate, action: "BLOCKED", reason: "PLACE_OWNERSHIP_NOT_LINKED", targetUserId, businessId, linkedPlaceIds: [] };
  }
  const linkedPlaceIds = linkedPlaces.map(place => place.id);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: targetUserId }, select: { role: true } });
  if (user.role === "BUSINESS_OWNER") {
    return { candidate, action: "SKIP_UNCHANGED", reason: null, targetUserId, businessId, linkedPlaceIds };
  }
  if (user.role !== "USER") {
    return { candidate, action: "BLOCKED", reason: "TARGET_USER_ROLE_NOT_ELIGIBLE", targetUserId, businessId, linkedPlaceIds };
  }

  return { candidate, action: "ELEVATE", reason: null, targetUserId, businessId, linkedPlaceIds };
}

/**
 * Executes the plan in one atomic, serializable transaction: re-verifies
 * every precondition against fresh reads inside the transaction, then
 * updates exactly `User.role`. `status`, `passwordHash`,
 * `emailVerifiedAt`, sessions, and action tokens are never referenced —
 * there is no code path in this function that can touch them. A
 * non-ELEVATE plan performs no mutation at all.
 */
export async function writeRoleElevationGolden(
  prisma: PrismaClient,
  plan: RoleElevationGoldenPlan,
): Promise<RoleElevationGoldenWriteResult> {
  if (plan.action !== "ELEVATE") {
    return { action: plan.action, targetUserId: plan.targetUserId };
  }
  if (!plan.targetUserId || !plan.businessId) throw new Error("ELEVATE plan is missing a resolved target User or Business.");

  return prisma.$transaction(
    async tx => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: plan.targetUserId! }, select: { role: true } });
      if (user.role !== "USER") throw new Error("ROLE_ELEVATION_CONFLICT: target User role is no longer USER.");

      const business = await tx.business.findUniqueOrThrow({ where: { id: plan.businessId! }, select: { ownerUserId: true } });
      if (business.ownerUserId !== plan.targetUserId) throw new Error("ROLE_ELEVATION_CONFLICT: Business owner no longer matches the target User.");

      const linkedPlaceCount = await tx.place.count({ where: { ownerBusinessId: plan.businessId! } });
      if (linkedPlaceCount === 0) throw new Error("ROLE_ELEVATION_CONFLICT: no Place is linked to the Business anymore.");

      const updated = await tx.user.updateMany({ where: { id: plan.targetUserId!, role: "USER" }, data: { role: "BUSINESS_OWNER" } });
      if (updated.count !== 1) throw new Error("ROLE_ELEVATION_CONFLICT: concurrent write changed the target User's role first.");

      return { action: "ELEVATE" as const, targetUserId: plan.targetUserId! };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
