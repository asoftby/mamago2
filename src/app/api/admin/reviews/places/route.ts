import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { parsePaginationParams } from "@/lib/api/pagination";
import { PlaceReviewStatus, PlaceReviewSource } from "@prisma/client";

/**
 * GET /api/admin/reviews/places
 * Получение всех отзывов о местах (mamaGo + Google)
 *
 * Доступ: ADMIN, EDITOR
 *
 * Query params:
 * - status: PENDING | PUBLISHED | HIDDEN | all
 * - source: MAMAGO | GOOGLE | all
 * - hasReply: true | false | all
 * - limit: number
 * - offset: number
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
    const statusParam = searchParams.get("status");
    const sourceParam = searchParams.get("source");
    const hasReplyParam = searchParams.get("hasReply");
    const { limit, skip: offset } = parsePaginationParams(searchParams, { defaultLimit: 50 });

    // Построить where условие
    const where: Record<string, unknown> = {};

    if (statusParam && statusParam !== "all") {
      where.status = statusParam as PlaceReviewStatus;
    }

    if (sourceParam && sourceParam !== "all") {
      where.source = sourceParam as PlaceReviewSource;
    }

    if (hasReplyParam && hasReplyParam !== "all") {
      if (hasReplyParam === "true") {
        where.ownerReplyText = { not: null };
      } else {
        where.ownerReplyText = null;
      }
    }

    // Получить отзывы
    const reviews = await prisma.placeReview.findMany({
      where,
      select: {
        id: true,
        placeId: true,
        source: true,
        authorName: true,
        authorAvatarUrl: true,
        rating: true,
        text: true,
        publishedAt: true,
        status: true,
        ownerReplyText: true,
        ownerReplyAuthorName: true,
        ownerReplyCreatedAt: true,
        ownerReplyUpdatedAt: true,
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

    const total = await prisma.placeReview.count({ where });

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
    console.error("[admin-reviews-places] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}
