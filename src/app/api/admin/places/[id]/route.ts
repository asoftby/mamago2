import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";

/**
 * DELETE /api/admin/places/[id]
 * Delete a place and all related data (admin only)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check if place exists
    const place = await prisma.place.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    // Delete place and all related data in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete place images
      await tx.placeImage.deleteMany({
        where: { placeId: id },
      });

      // Delete place revision images
      const revisions = await tx.placeRevision.findMany({
        where: { placeId: id },
        select: { id: true },
      });

      for (const revision of revisions) {
        await tx.placeRevisionImage.deleteMany({
          where: { revisionId: revision.id },
        });
      }

      // Delete place revisions (this will cascade delete opening hours)
      await tx.placeRevision.deleteMany({
        where: { placeId: id },
      });

      // Delete improvement requests
      await tx.improvementRequest.deleteMany({
        where: {
          entityType: "PLACE",
          entityId: id,
        },
      });

      // Delete moderation logs
      await tx.moderationLog.deleteMany({
        where: {
          entityType: "PLACE",
          entityId: id,
        },
      });

      // Delete place opening hours if exists
      const placeWithOpeningHours = await tx.place.findUnique({
        where: { id },
        select: { openingHoursId: true },
      });

      if (placeWithOpeningHours?.openingHoursId) {
        await tx.openingHours.delete({
          where: { id: placeWithOpeningHours.openingHoursId },
        });
      }

      // Finally, delete the place itself
      await tx.place.delete({
        where: { id },
      });
    });

    console.log(`[Admin] Place deleted: ${place.title} (${id}) by ${user.email}`);

    return NextResponse.json({
      success: true,
      message: "Place deleted successfully",
    });
  } catch (error: unknown) {
    console.error("[API] Delete place error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete place" },
      { status: 500 }
    );
  }
}
