import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/reviews/place-reviews/[id]/reply
 * Создание или обновление ответа автора на отзыв
 * 
 * Доступ: ADMIN, EDITOR
 * Body: { text: string }
 * 
 * Только для mamaGo отзывов
 */
export async function POST(
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
    const { text } = body;

    // Валидация
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "INVALID_TEXT", message: "Reply text is required" },
        { status: 400 }
      );
    }

    if (text.trim().length < 3) {
      return NextResponse.json(
        { error: "TEXT_TOO_SHORT", message: "Reply must be at least 3 characters" },
        { status: 400 }
      );
    }

    if (text.trim().length > 2000) {
      return NextResponse.json(
        { error: "TEXT_TOO_LONG", message: "Reply must be less than 2000 characters" },
        { status: 400 }
      );
    }

    // Проверить что отзыв существует и это mamaGo отзыв
    const review = await prisma.placeReview.findUnique({
      where: { id },
      select: { 
        id: true, 
        source: true,
        ownerReplyText: true,
      },
    });

    if (!review) {
      return NextResponse.json(
        { error: "REVIEW_NOT_FOUND", message: "Review not found" },
        { status: 404 }
      );
    }

    // Можно отвечать только на mamaGo отзывы
    if (review.source !== "MAMAGO") {
      return NextResponse.json(
        { 
          error: "CANNOT_REPLY_TO_GOOGLE_REVIEW", 
          message: "Cannot reply to Google reviews" 
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const isUpdate = !!review.ownerReplyText;

    // Создать или обновить ответ
    const updated = await prisma.placeReview.update({
      where: { id },
      data: {
        ownerReplyText: text.trim(),
        ownerReplyAuthorId: user.id,
        ownerReplyAuthorName: user.displayName || user.email,
        ownerReplyCreatedAt: isUpdate ? undefined : now,
        ownerReplyUpdatedAt: now,
      },
      select: {
        id: true,
        ownerReplyText: true,
        ownerReplyAuthorName: true,
        ownerReplyCreatedAt: true,
        ownerReplyUpdatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: isUpdate ? "Reply updated" : "Reply created",
    });
  } catch (error) {
    console.error("[admin-review-reply] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to save reply" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/reviews/place-reviews/[id]/reply
 * Удаление ответа автора
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
      select: { 
        id: true, 
        source: true,
        ownerReplyText: true,
      },
    });

    if (!review) {
      return NextResponse.json(
        { error: "REVIEW_NOT_FOUND", message: "Review not found" },
        { status: 404 }
      );
    }

    // Можно удалять ответ только у mamaGo отзывов
    if (review.source !== "MAMAGO") {
      return NextResponse.json(
        { 
          error: "CANNOT_DELETE_GOOGLE_REPLY", 
          message: "Cannot delete reply from Google reviews" 
        },
        { status: 400 }
      );
    }

    if (!review.ownerReplyText) {
      return NextResponse.json(
        { error: "NO_REPLY", message: "Review has no reply" },
        { status: 400 }
      );
    }

    // Удалить ответ
    await prisma.placeReview.update({
      where: { id },
      data: {
        ownerReplyText: null,
        ownerReplyAuthorId: null,
        ownerReplyAuthorName: null,
        ownerReplyCreatedAt: null,
        ownerReplyUpdatedAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Reply deleted",
    });
  } catch (error) {
    console.error("[admin-review-reply-delete] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to delete reply" },
      { status: 500 }
    );
  }
}
