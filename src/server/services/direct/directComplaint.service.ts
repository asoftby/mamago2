/**
 * Direct complaint (safety UX) command layer.
 */

import prisma from "@/lib/prisma";
import { DirectComplaintStatus } from "@prisma/client";
import {
  DIRECT_AUDIT_ENTITY,
  DirectAuditAction,
  writeDirectAudit,
} from "./directAudit";
import { recordDirectRiskSignal } from "./directRiskSignal.service";
import {
  notifyDirectComplaintOpened,
  notifyDirectComplaintResolved,
} from "@/server/services/notification.service";

export type DirectComplaintErrorCode = "NOT_FOUND" | "ALREADY_RESOLVED" | "INVALID";

export class DirectComplaintError extends Error {
  constructor(message: string, readonly code: DirectComplaintErrorCode = "INVALID") {
    super(message);
    this.name = "DirectComplaintError";
  }
}

export interface CreateComplaintInput {
  threadId: string;
  reporterUserId: string;
  reason: string;
  comment?: string | null;
}

export async function createComplaint(input: CreateComplaintInput) {
  const thread = await prisma.directThread.findUnique({
    where: { id: input.threadId },
    select: { id: true, businessId: true, customerUserId: true, threadNumber: true },
  });
  if (!thread) {
    throw new DirectComplaintError("Direct thread not found", "NOT_FOUND");
  }

  const reason = input.reason.trim();
  if (!reason) {
    throw new DirectComplaintError("Complaint reason cannot be empty");
  }

  const complaint = await prisma.directComplaint.create({
    data: {
      threadId: input.threadId,
      reporterUserId: input.reporterUserId,
      reason,
      comment: input.comment?.trim() || null,
      status: DirectComplaintStatus.PENDING,
    },
  });

  await writeDirectAudit({
    action: DirectAuditAction.COMPLAINT_CREATED,
    entityType: DIRECT_AUDIT_ENTITY.COMPLAINT,
    entityId: complaint.id,
    actorId: input.reporterUserId,
    actorRole: "USER",
    metadata: { threadId: input.threadId, reason },
  });

  await recordDirectRiskSignal({
    threadId: input.threadId,
    businessId: thread.businessId,
    customerUserId: thread.customerUserId,
    signalType: "COMPLAINT_OPENED",
    auditAction: DirectAuditAction.RISK_SIGNAL_CREATED,
    metadata: { complaintId: complaint.id, reason },
  });

  // Moderators learn about it without polling the admin page. Fire-and-forget:
  // a notification failure must never fail (or slow) the user's complaint.
  void notifyDirectComplaintOpened({
    complaintId: complaint.id,
    threadNumber: thread.threadNumber,
    reason,
  }).catch((error) => console.error("[direct] complaint-opened notify failed:", error));

  return complaint;
}

/**
 * Moderator decision on a complaint. `resolution` is a free-text note of
 * what was found/done — without it, a year from now nobody can tell why a
 * given complaint was closed a given way.
 */
export async function resolveComplaint(params: {
  complaintId: string;
  reviewedByUserId: string;
  actorRole: string;
  status:
    | typeof DirectComplaintStatus.REVIEWED
    | typeof DirectComplaintStatus.DISMISSED
    | typeof DirectComplaintStatus.ACTION_TAKEN;
  resolution: string;
}) {
  const resolution = params.resolution.trim();
  if (!resolution) {
    throw new DirectComplaintError("resolution cannot be empty");
  }

  const existing = await prisma.directComplaint.findUnique({
    where: { id: params.complaintId },
    select: {
      reporterUserId: true,
      threadId: true,
      thread: { select: { threadNumber: true, customerUserId: true } },
    },
  });
  if (!existing) {
    throw new DirectComplaintError("Complaint not found", "NOT_FOUND");
  }

  // Atomic PENDING → decided transition: two moderators (or a double click)
  // cannot both resolve it, so the reporter is notified exactly once.
  const { count } = await prisma.directComplaint.updateMany({
    where: { id: params.complaintId, status: DirectComplaintStatus.PENDING },
    data: {
      status: params.status,
      resolution,
      reviewedAt: new Date(),
      reviewedByUserId: params.reviewedByUserId,
    },
  });
  if (count === 0) {
    throw new DirectComplaintError("Complaint is already resolved", "ALREADY_RESOLVED");
  }
  const updated = await prisma.directComplaint.findUniqueOrThrow({ where: { id: params.complaintId } });

  await writeDirectAudit({
    action: DirectAuditAction.COMPLAINT_RESOLVED,
    entityType: DIRECT_AUDIT_ENTITY.COMPLAINT,
    entityId: updated.id,
    actorId: params.reviewedByUserId,
    actorRole: params.actorRole,
    reason: resolution,
    after: { status: params.status },
    metadata: { threadId: updated.threadId },
  });

  // The reporter hears the outcome in their own cabinet (customer or business).
  // Canned text only — the internal resolution note stays admin-only.
  void notifyDirectComplaintResolved({
    complaintId: updated.id,
    reporterUserId: existing.reporterUserId,
    reporterSurface: existing.reporterUserId === existing.thread.customerUserId ? "USER" : "BUSINESS",
    threadId: existing.threadId,
    threadNumber: existing.thread.threadNumber,
    outcome: params.status,
  }).catch((error) => console.error("[direct] complaint-resolved notify failed:", error));

  return updated;
}
