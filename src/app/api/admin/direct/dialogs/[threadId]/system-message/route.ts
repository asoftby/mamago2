import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";
import { sendSystemMessageForAdmin } from "@/server/services/direct/directAdmin.service";

const bodySchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

/**
 * threadId here identifies a specific occasion-thread within the dialog
 * (the admin UI defaults to AdminDialogDetail.latestOpenThreadId) — a system
 * message always belongs to one DirectThread, same as any other message.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;

  const { threadId } = await params;
  const thread = await prisma.directThread.findUnique({
    where: { id: threadId },
    select: { id: true },
  });
  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const json = await request.json();
    const { body } = bodySchema.parse(json);

    const message = await sendSystemMessageForAdmin({
      threadId,
      body,
      sentByUserId: auth.id,
    });
    return NextResponse.json(message);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    console.error("[admin/direct] system message error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
