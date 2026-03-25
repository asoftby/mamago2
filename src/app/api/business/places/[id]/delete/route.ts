/**
 * DELETE /api/business/places/[id]/delete
 * Delete a draft place (hard delete for now, can be changed to soft delete later)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ContentStatus } from "@prisma/client";
import { canCreateBusinessContent, canManageOwnedContent } from "@/lib/auth/businessContentAccess";

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
        ownerUserId: true,
        status: true,
      },
    });

    if (!place) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Place not found" },
        { status: 404 }
      );
    }

    if (!canManageOwnedContent(user, place.ownerUserId)) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "You don't have access to this place" },
        { status: 403 }
      );
    }

    // Only allow deleting DRAFT places
    if (place.status !== ContentStatus.DRAFT) {
      return NextResponse.json(
        {
          error: "INVALID_STATUS",
          message: "Only draft places can be deleted",
        },
        { status: 400 }
      );
    }

    // Delete the place (hard delete for now)
    await prisma.place.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[place-delete] ❌ Error:", error);
    console.error("[place-delete] Stack:", error instanceof Error ? error.stack : "No stack");

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to delete place",
      },
      { status: 500 }
    );
  }
}
