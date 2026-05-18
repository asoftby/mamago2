import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePhoneVerifiedUser } from "@/lib/auth/requirePhoneVerifiedUser";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/places/[id]/reviews
 * Создание отзыва mamaGo для места
 * 
 * Требования:
 * - Авторизация
 * - Подтвержденный телефон (verification gate для UGC)
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const userOrError = await requirePhoneVerifiedUser();
    if (userOrError instanceof NextResponse) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[create-review] Verification gate failed");
      }
      return userOrError;
    }
    const user = userOrError;

    const { id: placeId } = await context.params;

    // Получить место
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: {
        id: true,
        title: true,
        status: true,
      },
    });

    if (!place) {
      return NextResponse.json(
        { error: "PLACE_NOT_FOUND", message: "Place not found" },
        { status: 404 }
      );
    }

    // Можно оставлять отзывы только для опубликованных мест
    if (place.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "PLACE_NOT_PUBLISHED", message: "Cannot review unpublished place" },
        { status: 400 }
      );
    }

    // Получить данные из запроса
    const body = await request.json();
    const { rating, text } = body;

    // Валидация
    if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "INVALID_RATING", message: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "INVALID_TEXT", message: "Review text is required" },
        { status: 400 }
      );
    }

    if (text.trim().length < 10) {
      return NextResponse.json(
        { error: "TEXT_TOO_SHORT", message: "Review text must be at least 10 characters" },
        { status: 400 }
      );
    }

    if (text.trim().length > 5000) {
      return NextResponse.json(
        { error: "TEXT_TOO_LONG", message: "Review text must be less than 5000 characters" },
        { status: 400 }
      );
    }

    // Проверить, не оставлял ли пользователь уже отзыв
    const existingReview = await prisma.placeReview.findFirst({
      where: {
        placeId: placeId,
        source: "MAMAGO",
        // Проверяем по authorName, так как у нас нет userId в PlaceReview
        authorName: user.displayName || user.email,
      },
    });

    if (existingReview) {
      return NextResponse.json(
        { 
          error: "REVIEW_EXISTS", 
          message: "You have already reviewed this place" 
        },
        { status: 400 }
      );
    }

    // Создать отзыв
    const review = await prisma.placeReview.create({
      data: {
        placeId: placeId,
        source: "MAMAGO",
        sourceReviewId: null, // Для mamaGo отзывов не нужен
        authorName: user.displayName || user.email,
        authorAvatarUrl: user.avatarUrl,
        rating: rating,
        text: text.trim(),
        language: "ru",
        publishedAt: new Date(),
        relativeTimeDescription: null,
        status: "PENDING", // На модерации
      },
    });

    if (process.env.NODE_ENV !== "production") {
      console.info("[create-review] Review created", {
        id: review.id,
        placeId: review.placeId,
        rating: review.rating,
        status: review.status,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        reviewId: review.id,
        status: review.status,
        message: "Спасибо! Отзыв отправлен на модерацию.",
      },
    });
  } catch (error) {
    console.error("[create-review] Error");
    if (error instanceof Error) {
      console.error(error.message);
      if (process.env.NODE_ENV !== "production" && error.stack) {
        console.error(error.stack);
      }
    }
    
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
