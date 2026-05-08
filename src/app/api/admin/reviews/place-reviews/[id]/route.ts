import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { PlaceReviewStatus } from "@prisma/client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/reviews/place-reviews/[id]
 * Обновление статуса отзыва
 * 
 * Доступ: ADMIN, EDITOR
 * Body: { status: "PUBLISHED" | "HIDDEN" }
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    const { status } = body;

    // Валидация
    if (!status || !["PUBLISHED", "HIDDEN", "PENDING"].includes(status)) {
      return NextResponse.json(
        { error: "INVALID_STATUS", message: "Status must be PUBLISHED, HIDDEN, or PENDING" },
        { status: 400 }
      );
    }

    // Проверить что отзыв существует
    const review = await prisma.placeReview.findUnique({
      where: { id },
      select: { id: true, source: true, status: true },
    });

    if (!review) {
      return NextResponse.json(
        { error: "REVIEW_NOT_FOUND", message: "Review not found" },
        { status: 404 }
      );
    }

    // Обновить статус
    const updated = await prisma.placeReview.update({
      where: { id },
      data: { status: status as PlaceReviewStatus },
      select: {
        id: true,
        status: true,
        placeId: true,
        source: true,
        authorName: true,
        rating: true,
        text: true,
        publishedAt: true,
        ownerReplyText: true,
        ownerReplyAuthorName: true,
        ownerReplyCreatedAt: true,
        place: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Review ${status.toLowerCase()}`,
    });
  } catch (error) {
    console.error("[admin-review-update] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to update review" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/reviews/place-reviews/[id]
 * Удаление отзыва (только mamaGo)
 * 
 * Доступ: ADMIN, EDITOR
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    // Проверить что отзыв существует и это mamaGo отзыв
    const review = await prisma.placeReview.findUnique({
      where: { id },
      select: { id: true, source: true },
    });

    if (!review) {
      return NextResponse.json(
        { error: "REVIEW_NOT_FOUND", message: "Review not found" },
        { status: 404 }
      );
    }

    // Можно удалять только mamaGo отзывы
    if (review.source !== "MAMAGO") {
      return NextResponse.json(
        { 
          error: "CANNOT_DELETE_GOOGLE_REVIEW", 
          message: "Google reviews cannot be deleted, only hidden" 
        },
        { status: 400 }
      );
    }

    // Удалить отзыв
    await prisma.placeReview.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Review deleted",
    });
  } catch (error) {
    console.error("[admin-review-delete] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to delete review" },
      { status: 500 }
    );
  }
}
