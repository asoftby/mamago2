import type { PrismaClient } from "@prisma/client";
import type { ExactRecordExecutor } from "../adapter";
import type { PhoenixExpectedRecord, PhoenixRecordResult } from "../types";

/**
 * Creates the approved owner Business before Places. The committed base and
 * override artifacts are the authorization/evidence boundary; this adapter
 * never discovers candidates from target rows. Place ownership is attached
 * later by the Places writer through the owner's logical User lineage.
 */
export class BusinessesProductionExecutor implements ExactRecordExecutor {
  private static readonly SOURCE_HASH = "approved-business-ownership-2026-07-30";
  constructor(private readonly prisma: PrismaClient, private readonly sourceId: string) {}

  async execute(
    sourceRecordKey: string,
    expectedAction: PhoenixExpectedRecord["action"],
  ): Promise<PhoenixRecordResult> {
    try {
      const userLineages = await this.prisma.migrationLineage.findMany({ where: { sourceId: this.sourceId, sourceRecordKey, targetType: "USER", targetRole: "primary", isActive: true } });
      if (userLineages.length !== 1 || !userLineages[0].targetId) throw new Error(userLineages.length > 1 ? "USER_DEPENDENCY_AMBIGUOUS" : "USER_DEPENDENCY_NOT_FOUND");
      const userId = userLineages[0].targetId;
      const existingLineage = await this.prisma.migrationLineage.findUnique({ where: { sourceId_sourceRecordKey_targetType_targetRole: { sourceId: this.sourceId, sourceRecordKey, targetType: "BUSINESS", targetRole: "primary" } } });
      if (existingLineage) {
        const [business, user] = await Promise.all([
          existingLineage.targetId ? this.prisma.business.findUnique({ where: { id: existingLineage.targetId }, select: { ownerUserId: true } }) : null,
          this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
        ]);
        if (!existingLineage.isActive || existingLineage.lastSourceHash !== BusinessesProductionExecutor.SOURCE_HASH || !business || business.ownerUserId !== userId || user?.role !== "BUSINESS_OWNER") throw new Error("BUSINESS_LINEAGE_TARGET_MISMATCH");
        return { sourceRecordKey, action: expectedAction, outcome: "SKIPPED" };
      }
      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true, role: true, business: { select: { id: true } } } });
        if (user.business) throw new Error("USER_ALREADY_OWNS_A_DIFFERENT_BUSINESS");
        if (user.role !== "USER") throw new Error("TARGET_USER_ROLE_NOT_ELIGIBLE");
        const business = await tx.business.create({ data: { ownerUserId: userId, name: user.displayName?.trim() || `Business (${sourceRecordKey})` } });
        await tx.user.update({ where: { id: userId }, data: { role: "BUSINESS_OWNER" } });
        await tx.migrationLineage.create({ data: {
          sourceId: this.sourceId, sourceEntityType: "wordpress-db:user", sourceExternalId: sourceRecordKey.split(":").at(-1),
          sourceStableKey: sourceRecordKey, sourceRecordKey, targetType: "BUSINESS", targetId: business.id, targetRole: "primary",
          lastSourceHash: BusinessesProductionExecutor.SOURCE_HASH, lastPlanAction: "CREATE", isActive: true,
          lastSeenAt: new Date(), lastImportedAt: new Date(),
        } });
      });
      return { sourceRecordKey, action: expectedAction, outcome: "CREATED" };
    } catch (error) {
      return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: error instanceof Error ? error.message : String(error) };
    }
  }
}
