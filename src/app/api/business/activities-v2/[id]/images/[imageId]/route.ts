/** DELETE /api/business/activities-v2/[id]/images/[imageId] */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { canManageActivityById } from "@/lib/auth/activityAccess";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { id: activityId, imageId } = await params;
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { coverImageId: true },
    });
    if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    if (!(await canManageActivityById(user, activityId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const image = await prisma.activityImage.findUnique({
      where: { id: imageId },
      select: { activityId: true },
    });
    if (!image) return NextResponse.json({ error: "Image not found" }, { status: 404 });
    if (image.activityId !== activityId) {
      return NextResponse.json(
        { error: "Image does not belong to this activity" },
        { status: 403 },
      );
    }

    if (activity.coverImageId === imageId) {
      await prisma.activity.update({ where: { id: activityId }, data: { coverImageId: null } });
    }
    await prisma.activityImage.delete({ where: { id: imageId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete activity image error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
