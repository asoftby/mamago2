/** DELETE /api/business/temp-media/session/[sessionId] */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { checkBusinessToolPermission } from "@/server/permissions/business-permissions";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!(await checkBusinessToolPermission(user, "content.create"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { sessionId: wizardSessionId } = await params;
    const result = await prisma.tempMedia.updateMany({
      where: { ownerUserId: user.id, wizardSessionId, status: "TEMP" },
      data: { status: "DELETED" },
    });

    return NextResponse.json({ success: true, deletedCount: result.count });
  } catch (error) {
    console.error("Delete temp media session error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
