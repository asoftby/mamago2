import { createHash } from "node:crypto";

import { Prisma, PrismaClient } from "@prisma/client";

/**
 * USERS Slice 7 golden proof: exactly one `EXACT_LINK_CANDIDATE` from the
 * Slice 6 business-ownership plan (`docs/migration/business-ownership-plan.json`),
 * chosen for minimal complexity — a single unambiguous owned Place, no
 * existing Business conflict, full lineage coverage. This module
 * deliberately does *not* generalise to a batch runner: the authorized
 * scope for this slice is one candidate, not "any of the 36".
 *
 * Role is intentionally left untouched — Slice 6 already separated the
 * ownership action from the `roleRecommendation`; flipping USER to
 * BUSINESS_OWNER is a distinct, separately-authorized privilege-elevation
 * write and stays a future slice.
 */

export const BUSINESS_OWNERSHIP_SOURCE_NAMESPACE = "users-immutable-snapshot";
export const BUSINESS_OWNERSHIP_SOURCE_ENTITY_TYPE = "wordpress-db:user";

export type BusinessOwnershipGoldenAction = "CREATE" | "SKIP_UNCHANGED" | "BLOCKED";

export type BusinessOwnershipGoldenReason =
  | "USER_LINEAGE_MISSING"
  | "PLACE_LINEAGE_MISSING"
  | "PLACE_ALREADY_OWNED_BY_OTHER_BUSINESS"
  | "USER_ALREADY_OWNS_A_DIFFERENT_BUSINESS"
  | "TARGET_USER_ROLE_NOT_ELIGIBLE"
  | "BUSINESS_LINEAGE_TARGET_MISMATCH";

export interface BusinessOwnershipGoldenCandidate {
  /** e.g. "wordpress-db:user:38" */
  sourceRecordKey: string;
  legacyUserId: number;
  /** WordPress `places` post IDs owned by this user, e.g. ["9870"]. Exactly this set must have exact, active lineage. */
  placeSourcePostIds: readonly string[];
}

export interface BusinessOwnershipGoldenPlan {
  candidate: BusinessOwnershipGoldenCandidate;
  action: BusinessOwnershipGoldenAction;
  reason: BusinessOwnershipGoldenReason | null;
  canonicalHash: string;
  targetUserId: string | null;
  targetPlaceIds: readonly string[];
  existingBusinessId: string | null;
}

function placeSourceRecordKey(postId: string): string {
  return `wordpress-db:places:${postId}`;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalHash(candidate: BusinessOwnershipGoldenCandidate, targetUserId: string, targetPlaceIds: readonly string[]): string {
  return createHash("sha256")
    .update(stable({ sourceRecordKey: candidate.sourceRecordKey, targetUserId, targetPlaceIds: [...targetPlaceIds].sort() }))
    .digest("hex");
}

/**
 * Read-only reconciliation: resolves the exact User and Place lineage for
 * the candidate and classifies CREATE / SKIP_UNCHANGED / BLOCKED. Performs
 * no writes.
 */
export async function planBusinessOwnershipGolden(
  prisma: PrismaClient,
  candidate: BusinessOwnershipGoldenCandidate,
  sourceNamespace = BUSINESS_OWNERSHIP_SOURCE_NAMESPACE,
): Promise<BusinessOwnershipGoldenPlan> {
  const source = await prisma.migrationSource.findUnique({ where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace } } });

  const userLineage = source
    ? await prisma.migrationLineage.findUnique({
        where: { sourceId_sourceRecordKey_targetType_targetRole: { sourceId: source.id, sourceRecordKey: candidate.sourceRecordKey, targetType: "USER", targetRole: "primary" } },
      })
    : null;
  if (!userLineage?.isActive || !userLineage.targetId) {
    return { candidate, action: "BLOCKED", reason: "USER_LINEAGE_MISSING", canonicalHash: "", targetUserId: null, targetPlaceIds: [], existingBusinessId: null };
  }
  const targetUserId = userLineage.targetId;

  const placeLineages = await prisma.migrationLineage.findMany({
    where: { targetType: "PLACE", isActive: true, sourceRecordKey: { in: candidate.placeSourcePostIds.map(placeSourceRecordKey) } },
    select: { sourceRecordKey: true, targetId: true },
  });
  if (placeLineages.length !== candidate.placeSourcePostIds.length || placeLineages.some(row => !row.targetId)) {
    return { candidate, action: "BLOCKED", reason: "PLACE_LINEAGE_MISSING", canonicalHash: "", targetUserId, targetPlaceIds: [], existingBusinessId: null };
  }
  const targetPlaceIds = placeLineages.map(row => row.targetId!);

  const hash = canonicalHash(candidate, targetUserId, targetPlaceIds);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: targetUserId }, select: { role: true, business: { select: { id: true } } } });
  if (user.role !== "USER") {
    return { candidate, action: "BLOCKED", reason: "TARGET_USER_ROLE_NOT_ELIGIBLE", canonicalHash: hash, targetUserId, targetPlaceIds, existingBusinessId: null };
  }

  const businessLineage = source
    ? await prisma.migrationLineage.findUnique({
        where: { sourceId_sourceRecordKey_targetType_targetRole: { sourceId: source.id, sourceRecordKey: candidate.sourceRecordKey, targetType: "BUSINESS", targetRole: "primary" } },
      })
    : null;

  if (businessLineage?.isActive && businessLineage.targetId) {
    if (user.business?.id !== businessLineage.targetId) {
      return { candidate, action: "BLOCKED", reason: "BUSINESS_LINEAGE_TARGET_MISMATCH", canonicalHash: hash, targetUserId, targetPlaceIds, existingBusinessId: businessLineage.targetId };
    }
    const places = await prisma.place.findMany({ where: { id: { in: targetPlaceIds } }, select: { id: true, ownerBusinessId: true } });
    const allLinked = places.every(place => place.ownerBusinessId === businessLineage.targetId);
    if (allLinked) {
      return { candidate, action: "SKIP_UNCHANGED", reason: null, canonicalHash: hash, targetUserId, targetPlaceIds, existingBusinessId: businessLineage.targetId };
    }
    return { candidate, action: "BLOCKED", reason: "PLACE_ALREADY_OWNED_BY_OTHER_BUSINESS", canonicalHash: hash, targetUserId, targetPlaceIds, existingBusinessId: businessLineage.targetId };
  }

  if (user.business) {
    return { candidate, action: "BLOCKED", reason: "USER_ALREADY_OWNS_A_DIFFERENT_BUSINESS", canonicalHash: hash, targetUserId, targetPlaceIds, existingBusinessId: null };
  }

  const places = await prisma.place.findMany({ where: { id: { in: targetPlaceIds } }, select: { id: true, ownerBusinessId: true } });
  if (places.some(place => place.ownerBusinessId !== null)) {
    return { candidate, action: "BLOCKED", reason: "PLACE_ALREADY_OWNED_BY_OTHER_BUSINESS", canonicalHash: hash, targetUserId, targetPlaceIds, existingBusinessId: null };
  }

  return { candidate, action: "CREATE", reason: null, canonicalHash: hash, targetUserId, targetPlaceIds, existingBusinessId: null };
}

export interface BusinessOwnershipGoldenWriteResult {
  action: BusinessOwnershipGoldenAction;
  businessId: string | null;
  placeIds: readonly string[];
}

/**
 * Executes the plan in one atomic, serializable transaction: re-verifies
 * every precondition against fresh reads inside the transaction (never
 * trusts the outer plan's snapshot for the write itself), then creates the
 * Business, links the Place(s), and records lineage/bookkeeping. Role is
 * never touched. A non-CREATE plan performs no mutation at all.
 */
export async function writeBusinessOwnershipGolden(
  prisma: PrismaClient,
  plan: BusinessOwnershipGoldenPlan,
  sourceNamespace = BUSINESS_OWNERSHIP_SOURCE_NAMESPACE,
): Promise<BusinessOwnershipGoldenWriteResult> {
  if (plan.action !== "CREATE") {
    return { action: plan.action, businessId: plan.existingBusinessId, placeIds: plan.targetPlaceIds };
  }
  if (!plan.targetUserId || plan.targetPlaceIds.length === 0) throw new Error("CREATE plan is missing a resolved target User or target Place.");

  return prisma.$transaction(
    async tx => {
      const source = await tx.migrationSource.upsert({
        where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace } },
        create: { adapterKey: "wordpress-db", sourceNamespace, name: "Immutable WordPress User snapshot", scope: { goldenOnly: true } },
        update: {},
      });

      const existingBusinessLineage = await tx.migrationLineage.findUnique({
        where: { sourceId_sourceRecordKey_targetType_targetRole: { sourceId: source.id, sourceRecordKey: plan.candidate.sourceRecordKey, targetType: "BUSINESS", targetRole: "primary" } },
      });
      if (existingBusinessLineage) throw new Error("BUSINESS_OWNERSHIP_CREATE_CONFLICT: a BUSINESS lineage row already exists for this sourceRecordKey.");

      const user = await tx.user.findUniqueOrThrow({ where: { id: plan.targetUserId! }, select: { id: true, role: true, displayName: true, business: { select: { id: true } } } });
      if (user.role !== "USER") throw new Error("BUSINESS_OWNERSHIP_CREATE_CONFLICT: target User role is no longer eligible.");
      if (user.business) throw new Error("BUSINESS_OWNERSHIP_CREATE_CONFLICT: target User already owns a Business.");

      const places = await tx.place.findMany({ where: { id: { in: [...plan.targetPlaceIds] } }, select: { id: true, ownerBusinessId: true } });
      if (places.length !== plan.targetPlaceIds.length || places.some(place => place.ownerBusinessId !== null)) {
        throw new Error("BUSINESS_OWNERSHIP_CREATE_CONFLICT: a target Place is no longer unowned.");
      }

      const run = await tx.migrationRun.create({
        data: { sourceId: source.id, mode: "COMMIT", status: "RUNNING", adapterVersion: "business-ownership-golden-v1", startedAt: new Date() },
      });

      const business = await tx.business.create({ data: { ownerUserId: user.id, name: user.displayName?.trim() || `Business (${plan.candidate.sourceRecordKey})` } });

      const placeUpdate = await tx.place.updateMany({ where: { id: { in: [...plan.targetPlaceIds] }, ownerBusinessId: null }, data: { ownerBusinessId: business.id } });
      if (placeUpdate.count !== plan.targetPlaceIds.length) throw new Error("BUSINESS_OWNERSHIP_CREATE_CONFLICT: concurrent write claimed a target Place first.");

      const record = await tx.migrationRecord.create({
        data: {
          sourceId: source.id,
          runId: run.id,
          status: "LINKED",
          sourceEntityType: BUSINESS_OWNERSHIP_SOURCE_ENTITY_TYPE,
          sourceExternalId: String(plan.candidate.legacyUserId),
          sourceStableKey: plan.candidate.sourceRecordKey,
          sourceRecordKey: plan.candidate.sourceRecordKey,
          sourceHash: plan.canonicalHash,
          rawPayload: Prisma.JsonNull,
          normalizedPayload: { sourceRecordKey: plan.candidate.sourceRecordKey, legacyUserId: plan.candidate.legacyUserId, placeCount: plan.targetPlaceIds.length, roleChange: "NONE" },
          targetTypeHint: "BUSINESS",
          planAction: "CREATE",
          planSummary: { action: "CREATE", canonicalHash: plan.canonicalHash, placeCount: plan.targetPlaceIds.length },
          validationSummary: { blocked: false, reason: null },
        },
      });

      await tx.migrationLineage.create({
        data: {
          sourceId: source.id,
          recordId: record.id,
          runId: run.id,
          sourceEntityType: BUSINESS_OWNERSHIP_SOURCE_ENTITY_TYPE,
          sourceExternalId: String(plan.candidate.legacyUserId),
          sourceStableKey: plan.candidate.sourceRecordKey,
          sourceRecordKey: plan.candidate.sourceRecordKey,
          targetType: "BUSINESS",
          targetId: business.id,
          targetRole: "primary",
          lastSourceHash: plan.canonicalHash,
          lastPlanAction: "CREATE",
          isActive: true,
          lastSeenAt: new Date(),
          lastImportedAt: new Date(),
        },
      });

      await tx.migrationRun.update({ where: { id: run.id }, data: { status: "COMPLETED", finishedAt: new Date(), counters: { CREATE: 1 } } });

      return { action: "CREATE" as const, businessId: business.id, placeIds: plan.targetPlaceIds };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
