import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/moderation/reviews
 * Get all reviews with filters
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const hasReply = searchParams.get("hasReply");

    const where: Record<string, unknown> = {};

    // Filter by status
    if (status && status !== "all") {
      where.status = status.toUpperCase();
    }

    // Filter by source
    if (source && source !== "all") {
      where.source = source.toUpperCase();
    }

    // Filter by reply
    if (hasReply === "true") {
      where.ownerReplyText = { not: null };
    } else if (hasReply === "false") {
      where.ownerReplyText = null;
    }

    const reviews = await prisma.placeReview.findMany({
      where,
      include: {
        place: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: [
        { status: "asc" }, // PENDING first
        { createdAt: "desc" },
      ],
      take: 100, // Limit to 100 reviews
    });

    return NextResponse.json({
      success: true,
      data: {
        reviews,
        total: reviews.length,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/moderation/reviews error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
