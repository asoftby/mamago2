/**
 * DELETE /api/business/temp-media/session/[sessionId]
 * Delete all temp media for a wizard session (when user discards wizard)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { canCreateBusinessContent, canManageOwnedContent } from "@/lib/auth/businessContentAccess";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId: wizardSessionId } = await params;

    // Mark all session media as deleted
    const result = await prisma.tempMedia.updateMany({
      where: {
        ownerUserId: user.id,
        wizardSessionId,
        status: "TEMP",
      },
      data: {
        status: "DELETED",
      },
    });

    console.log(`[temp-media] Deleted ${result.count} temp media items for session ${wizardSessionId}`);

    return NextResponse.json({ success: true, deletedCount: result.count });
  } catch (error) {
    console.error("Delete temp media session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
