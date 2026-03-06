/**
 * POST /api/business/activities-v2/[id]/images
 * Add image to activity (cover or gallery)
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

    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: activityId } = await params;

    // Check ownership
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { ownerUserId: true },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    if (activity.ownerUserId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { url, width, height, blurhash, sortOrder, isCover } = body;

    // Validate required fields
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    // Get next sort order if not provided
    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined) {
      const lastImage = await prisma.activityImage.findFirst({
        where: { activityId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      finalSortOrder = (lastImage?.sortOrder || 0) + 1;
    }

    // Create image
    const image = await prisma.activityImage.create({
      data: {
        activityId,
        url,
        width: width || null,
        height: height || null,
        blurhash: blurhash || null,
        sortOrder: finalSortOrder,
      },
    });

    // If this is the cover image, update activity.coverImageId
    if (isCover) {
      await prisma.activity.update({
        where: { id: activityId },
        data: { coverImageId: image.id },
      });
    }

    return NextResponse.json({ image });
  } catch (error) {
    console.error("Add activity image error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
