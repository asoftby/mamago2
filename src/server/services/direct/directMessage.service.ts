/**
 * Direct message command layer.
 *
 * createDirectMessage() expects the caller to have already authorized the
 * sender against the thread (see requireDirectThreadAccess in
 * src/lib/auth/directAccess.ts) and to pass the resolved senderType —
 * this service only persists, it does not re-derive who is allowed to post.
 *
 * Messages are immutable: no update/delete path exists. Moderation is
 * soft-only via hideMessage() (hiddenAt/hiddenByUserId/hiddenReason).
 */

import prisma from "@/lib/prisma";
import {
  DirectActorType,
  DirectMessageHiddenReason,
  DirectThreadStatus,
} from "@prisma/client";
import {
  DIRECT_AUDIT_ENTITY,
  DirectAuditAction,
  writeDirectAudit,
} from "./directAudit";
import {
  checkDirectSendLimits,
  detectAndRecordContactEscapeSignals,
  recordDirectRiskSignal,
} from "./directRiskSignal.service";

export class DirectMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectMessageError";
  }
}

export interface CreateDirectMessageInput {
  threadId: string;
  senderType: DirectActorType;
  /** Concrete User who wrote it (BusinessMember for BUSINESS, null for SYSTEM). */
  senderUserId?: string | null;
  body: string;
}

export async function createDirectMessage(input: CreateDirectMessageInput) {
  const thread = await prisma.directThread.findUnique({
    where: { id: input.threadId },
    select: { id: true, status: true, businessId: true, customerUserId: true },
  });
  if (!thread) {
    throw new DirectMessageError("Direct thread not found");
  }
  if (thread.status === DirectThreadStatus.BLOCKED) {
    throw new DirectMessageError("Thread is blocked — messages cannot be sent");
  }
  if (thread.status === DirectThreadStatus.ARCHIVED) {
    throw new DirectMessageError("Thread is archived — read-only, messages cannot be sent");
  }

  const body = input.body.trim();
  if (!body) {
    throw new DirectMessageError("Message body cannot be empty");
  }

  // Trust & Safety (Phase 5): throws DirectSendLimitError on flood-lock/no-reply-cap.
  // Only CUSTOMER/BUSINESS are limited — the check itself is a no-op for SYSTEM/ADMIN.
  await checkDirectSendLimits({
    threadId: input.threadId,
    businessId: thread.businessId,
    customerUserId: thread.customerUserId,
    senderType: input.senderType,
  });

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.directMessage.create({
      data: {
        threadId: input.threadId,
        senderType: input.senderType,
        senderUserId: input.senderUserId ?? null,
        body,
      },
    });
    await tx.directThread.update({
      where: { id: input.threadId },
      data: {
        lastMessageAt: created.createdAt,
        lastMessageBy: input.senderType,
      },
    });
    return created;
  });

  await writeDirectAudit({
    action: DirectAuditAction.MESSAGE_CREATED,
    entityType: DIRECT_AUDIT_ENTITY.MESSAGE,
    entityId: message.id,
    actorId: input.senderUserId ?? null,
    actorRole: input.senderType,
    metadata: { threadId: input.threadId },
  });

  // Trust & Safety (Phase 5): detect contact-escape patterns for admin review.
  // Never hides the message or blocks the thread — signal-only.
  await detectAndRecordContactEscapeSignals({
    messageId: message.id,
    threadId: input.threadId,
    businessId: thread.businessId,
    customerUserId: thread.customerUserId,
    body,
  });

  return message;
}

export async function hideMessage(params: {
  messageId: string;
  hiddenByUserId: string;
  actorRole: string;
  reason: DirectMessageHiddenReason;
}) {
  const message = await prisma.directMessage.findUnique({
    where: { id: params.messageId },
    select: {
      id: true,
      threadId: true,
      hiddenAt: true,
      thread: { select: { businessId: true, customerUserId: true } },
    },
  });
  if (!message) {
    throw new DirectMessageError("Direct message not found");
  }
  if (message.hiddenAt) {
    return message;
  }

  const updated = await prisma.directMessage.update({
    where: { id: params.messageId },
    data: {
      hiddenAt: new Date(),
      hiddenByUserId: params.hiddenByUserId,
      hiddenReason: params.reason,
    },
  });

  await writeDirectAudit({
    action: DirectAuditAction.MESSAGE_HIDDEN,
    entityType: DIRECT_AUDIT_ENTITY.MESSAGE,
    entityId: updated.id,
    actorId: params.hiddenByUserId,
    actorRole: params.actorRole,
    reason: params.reason,
    metadata: { threadId: message.threadId },
  });

  await recordDirectRiskSignal({
    threadId: message.threadId,
    messageId: updated.id,
    businessId: message.thread.businessId,
    customerUserId: message.thread.customerUserId,
    signalType: "MESSAGE_HIDDEN",
    auditAction: DirectAuditAction.RISK_SIGNAL_CREATED,
    metadata: { reason: params.reason },
  });

  return updated;
}
