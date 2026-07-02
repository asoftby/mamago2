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

export class DirectComplaintError extends Error {
  constructor(message: string) {
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
    select: { id: true, businessId: true, customerUserId: true },
  });
  if (!thread) {
    throw new DirectComplaintError("Direct thread not found");
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

  const updated = await prisma.directComplaint.update({
    where: { id: params.complaintId },
    data: {
      status: params.status,
      resolution,
      reviewedAt: new Date(),
      reviewedByUserId: params.reviewedByUserId,
    },
  });

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

  return updated;
}
