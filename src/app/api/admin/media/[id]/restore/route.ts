/**
 * POST /api/admin/media/[id]/restore - Restore archived media file
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Update status to ACTIVE
    const updated = await prisma.mediaAsset.update({
      where: { id },
      data: {
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ success: true, media: updated });
  } catch (error: unknown) {
    console.error("Restore media error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to restore media" },
      { status: 500 }
    );
  }
}
