/** DELETE /api/business/temp-media/[id] */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { checkBusinessToolPermission } from "@/server/permissions/business-permissions";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!(await checkBusinessToolPermission(user, "content.create"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const result = await prisma.tempMedia.updateMany({
      where: { id, ownerUserId: user.id, status: "TEMP" },
      data: { status: "DELETED" },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Media not found or already deleted" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete temp media error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
