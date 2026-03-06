/**
 * DELETE /api/business/temp-media/[id]
 * Delete a single temp media item
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Mark as deleted (soft delete for now, can be hard deleted by cleanup job)
    const result = await prisma.tempMedia.updateMany({
      where: {
        id,
        ownerUserId: user.id,
        status: "TEMP",
      },
      data: {
        status: "DELETED",
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Media not found or already deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete temp media error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
