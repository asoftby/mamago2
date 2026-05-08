import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";

/**
 * GET /api/admin/reviews/moderation
 * Получение отзывов на модерации (status = PENDING)
 * 
 * Доступ: ADMIN, EDITOR
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Получить отзывы на модерации (только mamaGo)
    const reviews = await prisma.placeReview.findMany({
      where: {
        status: "PENDING",
        source: "MAMAGO", // Только mamaGo отзывы требуют модерации
      },
      select: {
        id: true,
        placeId: true,
        source: true,
        authorName: true,
        authorAvatarUrl: true,
        rating: true,
        text: true,
        publishedAt: true,
        createdAt: true,
        place: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await prisma.placeReview.count({
      where: {
        status: "PENDING",
        source: "MAMAGO",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        reviews,
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("[admin-reviews-moderation] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}
