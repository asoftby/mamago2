import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";

/**
 * PATCH /api/admin/moderation/reviews/place-reviews/[id]
 * Update review status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !["PENDING", "PUBLISHED", "HIDDEN"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status" },
        { status: 400 }
      );
    }

    const review = await prisma.placeReview.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({
      success: true,
      data: { review },
    });
  } catch (error) {
    console.error("PATCH /api/admin/moderation/reviews/place-reviews/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/moderation/reviews/place-reviews/[id]
 * Delete review (only mamaGo reviews)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check if review is from mamaGo
    const review = await prisma.placeReview.findUnique({
      where: { id },
      select: { source: true },
    });

    if (!review) {
      return NextResponse.json(
        { success: false, error: "Review not found" },
        { status: 404 }
      );
    }

    if (review.source !== "MAMAGO") {
      return NextResponse.json(
        { success: false, error: "Cannot delete Google reviews" },
        { status: 400 }
      );
    }

    await prisma.placeReview.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Review deleted",
    });
  } catch (error) {
    console.error("DELETE /api/admin/moderation/reviews/place-reviews/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
