import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";
import { blockDialogForAdmin } from "@/server/services/direct/directAdmin.service";

const bodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;

  const { threadId } = await params;
  const thread = await prisma.directThread.findUnique({
    where: { id: threadId },
    select: { businessId: true, customerUserId: true },
  });
  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const json = await request.json().catch(() => ({}));
    const { reason } = bodySchema.parse(json);

    const result = await blockDialogForAdmin({
      businessId: thread.businessId,
      customerUserId: thread.customerUserId,
      blockedByUserId: auth.id,
      actorRole: auth.role,
      reason: reason ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    console.error("[admin/direct] block dialog error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
