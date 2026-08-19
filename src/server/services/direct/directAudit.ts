/**
 * Direct audit logging — thin wrapper over the existing AdminAuditLog model.
 * No new audit table: AdminAuditLog.entityType/entityId are already generic
 * strings, so Direct events slot in without a schema change.
 */

import type { Prisma } from "@prisma/client";
import { logAdminAudit } from "@/server/services/adminAuditLog.service";

export const DIRECT_AUDIT_ENTITY = {
  THREAD: "DIRECT_THREAD",
  MESSAGE: "DIRECT_MESSAGE",
  COMPLAINT: "DIRECT_COMPLAINT",
  RISK_SIGNAL: "DIRECT_RISK_SIGNAL",
  PLATFORM_SETTINGS: "DIRECT_PLATFORM_SETTINGS",
} as const;

export type DirectAuditEntityType =
  (typeof DIRECT_AUDIT_ENTITY)[keyof typeof DIRECT_AUDIT_ENTITY];

export const DirectAuditAction = {
  THREAD_CREATED: "THREAD_CREATED",
  MESSAGE_CREATED: "MESSAGE_CREATED",
  MESSAGE_HIDDEN: "MESSAGE_HIDDEN",
  THREAD_BLOCKED: "THREAD_BLOCKED",
  THREAD_UNBLOCKED: "THREAD_UNBLOCKED",
  THREAD_COMPLETED: "THREAD_COMPLETED",
  COMPLAINT_CREATED: "COMPLAINT_CREATED",
  COMPLAINT_RESOLVED: "COMPLAINT_RESOLVED",
  RISK_SIGNAL_CREATED: "RISK_SIGNAL_CREATED",
  FLOOD_LOCK_TRIGGERED: "FLOOD_LOCK_TRIGGERED",
  NO_REPLY_CAP_TRIGGERED: "NO_REPLY_CAP_TRIGGERED",
  REPEATED_LIMIT_TRIGGERED: "REPEATED_LIMIT_TRIGGERED",
  DIRECT_SETTINGS_UPDATED: "DIRECT_SETTINGS_UPDATED",
} as const;

export type DirectAuditAction =
  (typeof DirectAuditAction)[keyof typeof DirectAuditAction];

export interface WriteDirectAuditParams {
  action: DirectAuditAction;
  entityType: DirectAuditEntityType;
  entityId: string;
  actorId?: string | null;
  /** Role string at time of action (USER / BUSINESS / ADMIN / MODERATOR / SYSTEM). */
  actorRole: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

export async function writeDirectAudit(params: WriteDirectAuditParams) {
  return logAdminAudit({
    actorId: params.actorId ?? null,
    actorRole: params.actorRole,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    before: params.before ?? null,
    after: params.after ?? null,
    reason: params.reason ?? null,
    metadata: params.metadata ?? null,
  });
}
