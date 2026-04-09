/**
 * DELETE /api/business/activities-v2/[id]/images/[imageId]
 * Remove image from activity
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { canManageActivityById } from "@/lib/auth/activityAccess";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: activityId, imageId } = await params;

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { coverImageId: true },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    if (!(await canManageActivityById(user, activityId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if image exists and belongs to this activity
    const image = await prisma.activityImage.findUnique({
      where: { id: imageId },
      select: { activityId: true },
    });

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    if (image.activityId !== activityId) {
      return NextResponse.json(
        { error: "Image does not belong to this activity" },
        { status: 403 }
      );
    }

    // If this is the cover image, clear activity.coverImageId
    if (activity.coverImageId === imageId) {
      await prisma.activity.update({
        where: { id: activityId },
        data: { coverImageId: null },
      });
    }

    // Delete image
    await prisma.activityImage.delete({
      where: { id: imageId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete activity image error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
