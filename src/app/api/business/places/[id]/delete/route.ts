/**
 * DELETE /api/business/places/[id]/delete
 * Delete a draft place (hard delete for now, can be changed to soft delete later)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";
import { detachImportedRecordsForCatalogEntity } from "@/server/modules/import/services/import-link-reconciliation.service";
import {
  assertCanHardDeleteContent,
  isContentHardDeleteError,
} from "@/server/services/contentHardDelete.service";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check ownership and status
    const place = await prisma.place.findUnique({
      where: { id },
      select: {
        createdByUserId: true,
        ownerBusinessId: true,
        status: true,
      },
    });

    if (!place) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Place not found" },
        { status: 404 }
      );
    }

    const canManage = await canManagePlaceAsync(user, place);
    if (!canManage) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "You don't have access to this place" },
        { status: 403 }
      );
    }

    await assertCanHardDeleteContent({
      contentType: "PLACE",
      contentId: id,
      status: place.status,
      prisma,
    });

    // Delete the place (hard delete for now)
    await detachImportedRecordsForCatalogEntity(
      {
        entityType: "PLACE",
        entityId: id,
        reason: "Связанный Place был удалён и больше не считается активной сущностью каталога.",
      },
      prisma,
    );
    await prisma.place.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isContentHardDeleteError(error)) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
          reasons: error.reasons,
        },
        { status: error.statusCode },
      );
    }
    console.error("[place-delete] ❌ Error:", error);
    console.error("[place-delete] Stack:", error instanceof Error ? error.stack : "No stack");

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}
