import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";
import { unblockDialogForAdmin } from "@/server/services/direct/directAdmin.service";

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
    const result = await unblockDialogForAdmin({
      businessId: thread.businessId,
      customerUserId: thread.customerUserId,
      unblockedByUserId: auth.id,
      actorRole: auth.role,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[admin/direct] unblock dialog error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
