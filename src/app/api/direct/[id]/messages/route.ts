import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DirectActorType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import {
  nextResponseFromDirectAccessError,
  requireDirectThreadAccess,
  resolveDirectActorType,
} from "@/lib/auth/directAccess";
import { checkRateLimit } from "@/lib/security/rateLimit";
import {
  createDirectMessage,
  DirectMessageError,
} from "@/server/services/direct/directMessage.service";
import { DirectSendLimitError } from "@/server/services/direct/directRiskSignal.service";
import { notifyDirectMessage } from "@/server/services/notification.service";
import prisma from "@/lib/prisma";

const sendMessageSchema = z.object({
  body: z.string().min(1, "Введите сообщение").max(2000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();

  let thread;
  try {
    thread = await requireDirectThreadAccess(user, id);
  } catch (error) {
    return nextResponseFromDirectAccessError(error) ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // requireDirectThreadAccess already rejects unauthenticated users (401), so user is non-null here.
  const currentUser = user!;

  const rateLimit = await checkRateLimit(`direct_message:${currentUser.id}`, 30, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const data = sendMessageSchema.parse(body);

    const senderType = resolveDirectActorType(currentUser, thread);
    // senderUserId always records the real actor (CUSTOMER/BUSINESS/ADMIN are
    // all live people) for audit/accountability — masking which BusinessMember
    // wrote a message from the *customer*'s view happens at the DTO layer
    // (directConversation.service.ts never selects/returns senderUserId), not here.
    const message = await createDirectMessage({
      threadId: thread.id,
      senderType: DirectActorType[senderType],
      senderUserId: currentUser.id,
      body: data.body,
    });

    void notifyOtherSide({ threadId: thread.id, senderType, senderUserId: currentUser.id, messageId: message.id });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    if (error instanceof DirectSendLimitError) {
      const status = error.kind === "FLOOD_LOCK" ? 429 : 403;
      return NextResponse.json({ error: error.message }, { status });
    }
    if (error instanceof DirectMessageError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[direct] send message error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function notifyOtherSide(params: {
  threadId: string;
  senderType: "CUSTOMER" | "BUSINESS" | "ADMIN";
  senderUserId: string;
  messageId: string;
}) {
  try {
    const thread = await prisma.directThread.findUnique({
      where: { id: params.threadId },
      select: { threadNumber: true, customerUserId: true, business: { select: { ownerUserId: true } } },
    });
    if (!thread) return;

    // The customer is always the recipient unless they themselves sent it.
    const recipientUserId =
      params.senderType === "CUSTOMER" ? thread.business.ownerUserId : thread.customerUserId;
    const recipientSurface = params.senderType === "CUSTOMER" ? "BUSINESS" : "USER";

    await notifyDirectMessage({
      recipientUserId,
      recipientSurface,
      threadId: params.threadId,
      threadNumber: thread.threadNumber,
      messageId: params.messageId,
    });
  } catch (e) {
    console.error("[direct] notifyDirectMessage failed:", e);
  }
}
