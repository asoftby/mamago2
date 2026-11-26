import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { notifySupportMessage } from "@/server/support/supportNotifications";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { requireSupportThreadAccess, requireSupportMessageActor, isSupportStaff, SupportAccessError } from "@/server/support/supportAccess";
import { getBusinessMembership } from "@/server/permissions/business-permissions";

const bodyInput = z.object({ body: z.string().trim().min(1).max(3000), requestKey: z.string().uuid().optional(), actor: z.enum(["BUSINESS", "STAFF"]).optional() });
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const limit = await checkRateLimit(`support_reply:${user.id}`, 30, 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  try {
    const { id } = await params;
    const thread = await requireSupportThreadAccess(user, id);
    const { body, requestKey: requestedKey, actor: requestedActor } = bodyInput.parse(await request.json());
    // Business-cabinet members may also have a platform staff role.
    // Validate the chosen sender against active membership or staff role.
    const messageActor = requestedActor ?? (isSupportStaff(user) ? "STAFF" : "BUSINESS");
    const member = messageActor === "BUSINESS" ? await getBusinessMembership(user.id, thread.businessId) : null;
    requireSupportMessageActor(user, messageActor, Boolean(member));
    const requestKey = requestedKey ?? randomUUID();
    const message = await prisma.$transaction(async tx => {
      const previous = await tx.supportMessage.findUnique({
        where: { requestKey }, select: { id: true, threadId: true, authorId: true, actor: true, body: true, createdAt: true },
      });
      if (previous) {
        if (previous.threadId !== id || previous.authorId !== user.id || previous.actor !== messageActor || previous.body !== body) {
          throw new SupportAccessError(409, "Request key already used");
        }
        return previous;
      }
      // Status is guarded in the DB to prevent writes after concurrent close.
      const updated = await tx.supportThread.updateMany({
        where: { id, status: { not: "CLOSED" } },
        data: { lastMessageAt: new Date(), ...(messageActor === "STAFF" ? { status: "IN_PROGRESS" as const } : {}) },
      });
      if (!updated.count) return null;
      return tx.supportMessage.create({ data: {
        id: randomUUID(), requestKey, threadId: id, authorId: user.id,
        actor: messageActor, body,
      }, select: { id: true, threadId: true, authorId: true, actor: true, body: true, createdAt: true } });
    });
    if (!message) return NextResponse.json({ error: "Conversation closed" }, { status: 409 });
    await notifySupportMessage({
      threadId: id, businessId: thread.businessId, messageId: message.id,
      senderId: user.id, actor: message.actor,
    });
    return NextResponse.json(message, { status: 201 });
  } catch (e) {
    if (e instanceof SupportAccessError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Validation error" }, { status: 400 });
    console.error("[support] reply failed", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
