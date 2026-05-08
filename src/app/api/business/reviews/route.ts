import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import prisma from "@/lib/prisma";

/**
 * GET /api/business/reviews
 * Get reviews for business's places
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get business profile
    const business = await getMyBusiness(user.id);

    if (!business) {
      return NextResponse.json(
        { success: false, error: "Business profile not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source");
    const hasReply = searchParams.get("hasReply");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {
      place: {
        ownerBusinessId: business.id,
      },
      // Only show PUBLISHED and HIDDEN reviews (not PENDING - that's for admin)
      status: {
        in: ["PUBLISHED", "HIDDEN"],
      },
    };

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

    // Filter by status
    if (status && status !== "all") {
      where.status = status.toUpperCase();
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
        { createdAt: "desc" },
      ],
      take: 100, // Limit to 100 reviews
    });

    // Calculate stats
    const allReviews = await prisma.placeReview.findMany({
      where: {
        place: {
          ownerBusinessId: business.id,
        },
        status: "PUBLISHED",
      },
      select: {
        rating: true,
        ownerReplyText: true,
      },
    });

    const stats = {
      total: allReviews.length,
      withoutReply: allReviews.filter((r) => !r.ownerReplyText).length,
      averageRating:
        allReviews.length > 0
          ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
          : 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        reviews,
        stats,
      },
    });
  } catch (error) {
    console.error("GET /api/business/reviews error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
