import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { logAdminAudit } from "./adminAuditLog.service";

export interface AuditLogParams {
  actorId: string;
  targetType: string;
  targetId: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Thin compatibility adapter over the canonical `logAdminAudit()` (§21
 * Step 6, frozen §12). New writes go to AdminAuditLog only — the legacy
 * AuditLog table is no longer written here, only read (see
 * getUserAuditLog/getAdminAuditLog below) for historical rows written
 * before this adapter existed.
 *
 * actorRole is resolved from the actor's CURRENT User.role rather than
 * accepted as a param — the legacy signature never carried a role, and
 * AdminAuditLog requires one. `actorId` was always a required FK to User
 * in the old schema, so every legitimate caller's actor is guaranteed to
 * resolve; if it doesn't, that is a real data-integrity error and the
 * lookup throws, matching the old FK-violation failure mode rather than
 * fabricating a role.
 */
export async function logAudit(params: AuditLogParams) {
  const { actorId, targetType, targetId, action, metadata, ipAddress, userAgent } = params;

  const actor = await prisma.user.findUniqueOrThrow({
    where: { id: actorId },
    select: { role: true },
  });

  // ipAddress/userAgent have no dedicated AdminAuditLog columns — preserved
  // without loss under a namespaced metadata key rather than discarded.
  const metadataObject =
    metadata !== undefined && metadata !== null && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Prisma.JsonObject)
      : undefined;
  const legacyContext =
    ipAddress !== undefined || userAgent !== undefined
      ? { ipAddress: ipAddress ?? null, userAgent: userAgent ?? null }
      : undefined;
  const enrichedMetadata: Prisma.InputJsonValue | undefined = legacyContext
    ? { ...(metadataObject ?? {}), legacyContext }
    : metadata;

  return logAdminAudit({
    actorId,
    actorRole: actor.role,
    action,
    entityType: targetType,
    entityId: targetId,
    metadata: enrichedMetadata,
  });
}

// Get audit log for a specific user (as target)
export async function getUserAuditLog(userId: string, limit = 50) {
  const logs = await prisma.auditLog.findMany({
    where: {
      targetType: "USER",
      targetId: userId,
    },
    include: {
      actor: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return logs;
}

// Get audit log for actions performed by an admin
export async function getAdminAuditLog(actorId: string, limit = 50) {
  const logs = await prisma.auditLog.findMany({
    where: { actorId },
    include: {
      target: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return logs;
}
