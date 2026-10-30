import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { notifySupportMessage } from "@/server/support/supportNotifications";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { requireSupportThreadAccess, isSupportStaff, SupportAccessError } from "@/server/support/supportAccess";

const bodyInput = z.object({ body: z.string().trim().min(1).max(3000) });
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const limit = await checkRateLimit(`support_reply:${user.id}`, 30, 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  try {
    const { id } = await params;
    const thread = await requireSupportThreadAccess(user, id);
    if (thread.status === "CLOSED") return NextResponse.json({ error: "Conversation closed" }, { status: 409 });
    const { body } = bodyInput.parse(await request.json());
    const message = await prisma.$transaction(async tx => {
      // Status is guarded in the DB to prevent writes after concurrent close.
      const updated = await tx.supportThread.updateMany({
        where: { id, status: { not: "CLOSED" } },
        data: { lastMessageAt: new Date(), ...(isSupportStaff(user) ? { status: "IN_PROGRESS" as const } : {}) },
      });
      if (!updated.count) return null;
      return tx.supportMessage.create({ data: {
        id: randomUUID(), threadId: id, authorId: user.id,
        actor: isSupportStaff(user) ? "STAFF" : "BUSINESS", body,
      }, select: { id: true, actor: true, body: true, createdAt: true } });
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
