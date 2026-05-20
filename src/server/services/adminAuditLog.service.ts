import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export interface CreateAdminAuditLogParams {
  actorId?: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

export async function logAdminAudit(params: CreateAdminAuditLogParams) {
  return prisma.adminAuditLog.create({
    data: {
      actorId: params.actorId ?? null,
      actorRole: params.actorRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      before: params.before ?? undefined,
      after: params.after ?? undefined,
      reason: params.reason ?? undefined,
      metadata: params.metadata ?? undefined,
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
  });
}

export async function getAdminAuditLogsForEntity(
  entityType: string,
  entityId: string,
  limit = 50,
) {
  return prisma.adminAuditLog.findMany({
    where: {
      entityType,
      entityId,
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
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
}
