import prisma from "@/lib/prisma";

export interface AuditLogParams {
  actorId: string;
  targetType: string;
  targetId: string;
  action: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

// Log an audit entry
export async function logAudit(params: AuditLogParams) {
  const { actorId, targetType, targetId, action, metadata, ipAddress, userAgent } = params;

  const log = await prisma.auditLog.create({
    data: {
      actorId,
      targetType,
      targetId,
      action,
      metadata: metadata || undefined,
      ipAddress,
      userAgent,
    },
  });

  return log;
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
