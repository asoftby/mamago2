import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import {
  convertGoogleReviewsToStored,
  getPlaceDetails,
} from "@/lib/google-places/client";
import { classifyGoogleReviewsMatch, mergeGoogleReviewsMeta, readGoogleReviewsPayload } from "@/lib/place/googleReviewsMeta";
import { Prisma } from "@prisma/client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/places/[id]/sync-google-reviews
 * Синхронизация отзывов Google для места
 * 
 * Сохраняет отзывы в модель PlaceReview с source = GOOGLE
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    console.log("[sync-google-reviews] Starting sync...");
    
    // Проверка авторизации
    const user = await getCurrentUser();
    if (!user) {
      console.error("[sync-google-reviews] Unauthorized");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[sync-google-reviews] User:", {
      id: user.id,
      role: user.role,
    });

    const { id: placeId } = await context.params;
    console.log("[sync-google-reviews] Place ID:", placeId);

    // Получить место
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: {
        id: true,
        title: true,
        formattedAddr: true,
        customAddress: true,
        googlePlaceId: true,
        googleReviewsJson: true,
        ownerBusinessId: true,
        createdByUserId: true,
      },
    });

    if (!place) {
      return NextResponse.json(
        { error: "Place not found" },
        { status: 404 }
      );
    }

    // Проверка прав доступа
    const isAdmin = user.role === "ADMIN";
    const isOwner = place.createdByUserId === user.id;
    
    // Проверяем через BusinessMember или через ownerBusinessId
    let isBusinessOwner = false;
    if (place.ownerBusinessId) {
      const businessMember = await prisma.businessMember.findFirst({
        where: {
          userId: user.id,
          businessId: place.ownerBusinessId,
          isActive: true,
        },
      });
      isBusinessOwner = !!businessMember;
    }

    if (!isAdmin && !isOwner && !isBusinessOwner) {
      return NextResponse.json(
        { error: "Forbidden: You don't have permission to sync reviews for this place" },
        { status: 403 }
      );
    }

    // Проверка наличия Google Place ID
    if (!place.googlePlaceId) {
      return NextResponse.json(
        {
          error: "GOOGLE_PLACE_ID_MISSING",
          message: "This place doesn't have a Google Place ID. Please add it first in the Location section.",
        },
        { status: 400 }
      );
    }

    // Получить данные из Google Places API
    console.log("[sync-google-reviews] Fetching place details from Google:", {
      placeId: place.id,
      placeTitle: place.title,
      googlePlaceId: place.googlePlaceId,
    });

    const placeDetails = await getPlaceDetails(place.googlePlaceId);

    if (!placeDetails) {
      console.error("[sync-google-reviews] Failed to fetch place details");
      return NextResponse.json(
        {
          error: "GOOGLE_API_ERROR",
          message: "Could not retrieve data from Google Places API. Please try again later.",
        },
        { status: 500 }
      );
    }

    console.log("[sync-google-reviews] Place details received:", {
      rating: placeDetails.rating,
      userRatingCount: placeDetails.userRatingCount,
      reviewsCount: placeDetails.reviews?.length || 0,
    });

    // Проверка: если нет рейтинга и отзывов
    if (!placeDetails.rating && !placeDetails.userRatingCount && (!placeDetails.reviews || placeDetails.reviews.length === 0)) {
      console.log("[sync-google-reviews] ⚠️ No reviews or rating found for this place");
      return NextResponse.json(
        {
          error: "NO_REVIEWS_FOUND",
          message: "This place doesn't have any reviews or rating in Google Maps yet. Make sure you're using the correct Google Place ID for the business (not the address).",
        },
        { status: 404 }
      );
    }

    // Синхронизировать отзывы в PlaceReview
    let syncedReviewsCount = 0;
    let createdCount = 0;
    let updatedCount = 0;

    if (placeDetails.reviews && placeDetails.reviews.length > 0) {
      console.log("[sync-google-reviews] Syncing reviews to PlaceReview model...");

      for (const googleReview of placeDetails.reviews) {
        try {
          // Извлечь ID отзыва из resource name
          // Format: "places/ChIJ.../reviews/ChZDSUhNMG9nS0VMTzhfTmp4b2NyVE53EAE"
          const sourceReviewId = googleReview.name.split("/reviews/")[1] || googleReview.name;

          // Upsert отзыва в PlaceReview
          const result = await prisma.placeReview.upsert({
            where: {
              placeId_source_sourceReviewId: {
                placeId: place.id,
                source: "GOOGLE",
                sourceReviewId: sourceReviewId,
              },
            },
            create: {
              placeId: place.id,
              source: "GOOGLE",
              sourceReviewId: sourceReviewId,
              authorName: googleReview.authorAttribution.displayName,
              authorAvatarUrl: googleReview.authorAttribution.photoUri || null,
              rating: googleReview.rating,
              text: googleReview.originalText?.text ?? googleReview.text?.text ?? null,
              language: googleReview.text?.languageCode || null,
              publishedAt: new Date(googleReview.publishTime),
              relativeTimeDescription: null,
              status: "PUBLISHED", // Google отзывы сразу опубликованы
            },
            update: {
              authorName: googleReview.authorAttribution.displayName,
              authorAvatarUrl: googleReview.authorAttribution.photoUri || null,
              rating: googleReview.rating,
              text: googleReview.originalText?.text ?? googleReview.text?.text ?? null,
              language: googleReview.text?.languageCode || null,
              relativeTimeDescription: null,
              // publishedAt не обновляем - оставляем оригинальную дату
            },
          });

          syncedReviewsCount++;
          
          // Проверяем был ли создан новый отзыв или обновлен существующий
          // (Prisma не возвращает эту информацию напрямую, но мы можем проверить по createdAt)
          const isNew = result.createdAt.getTime() === result.updatedAt.getTime();
          if (isNew) {
            createdCount++;
          } else {
            updatedCount++;
          }

          console.log(`[sync-google-reviews] Synced review: ${sourceReviewId} (${isNew ? 'created' : 'updated'})`);
        } catch (reviewError) {
          console.error(`[sync-google-reviews] Error syncing review ${googleReview.name}:`, reviewError);
          // Продолжаем синхронизацию остальных отзывов
        }
      }

      console.log("[sync-google-reviews] Reviews sync complete:", {
        total: syncedReviewsCount,
        created: createdCount,
        updated: updatedCount,
      });
    }

    // Обновить агрегированные данные в Place
    const currentPayload = readGoogleReviewsPayload(place.googleReviewsJson);
    const classified = classifyGoogleReviewsMatch({
      placeTitle: place.title,
      placeAddress: place.formattedAddr || place.customAddress,
      googlePlaceId: place.googlePlaceId,
      googlePlaceName: placeDetails.displayName?.text,
      googlePlaceAddress: placeDetails.formattedAddress,
    });
    const nextMeta = currentPayload?.meta?.enabled
      ? { ...classified, enabled: true, matchStatus: "CONFIRMED" as const, disabledReason: null }
      : classified;

    const storedGoogleReviews = convertGoogleReviewsToStored(placeDetails);
    const syncedAt = new Date();
    const nextPayload = {
      ...(currentPayload ?? {}),
      reviews: storedGoogleReviews,
      syncedAt: syncedAt.toISOString(),
      meta: {
        enabled: false,
        matchStatus: "DISABLED" as const,
        disabledReason: null,
        googlePlaceName: null,
        googlePlaceAddress: null,
        confirmedManually: false,
        ...mergeGoogleReviewsMeta(place.googleReviewsJson, nextMeta).meta,
      },
    };

    const updatedPlace = await prisma.place.update({
      where: { id: placeId },
      data: {
        googleRating: placeDetails.rating || null,
        googleUserRatingsTotal: placeDetails.userRatingCount || null,
        googleReviewsSyncedAt: syncedAt,
        googleMapsUri: placeDetails.googleMapsUri || null,
        googleReviewsJson: nextPayload as unknown as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        googleRating: true,
        googleUserRatingsTotal: true,
        googleReviewsSyncedAt: true,
        googleReviewsJson: true,
      },
    });

    console.log("[sync-google-reviews] ✅ Sync completed successfully");

    return NextResponse.json({
      success: true,
      data: {
        placeId: updatedPlace.id,
        rating: updatedPlace.googleRating,
        ratingsTotal: updatedPlace.googleUserRatingsTotal,
        reviewsCount: syncedReviewsCount,
        reviewsCreated: createdCount,
        reviewsUpdated: updatedCount,
        syncedAt: updatedPlace.googleReviewsSyncedAt,
        googleReviewsJson: updatedPlace.googleReviewsJson,
      },
    });
  } catch (error) {
    console.error("[sync-google-reviews] ❌ Error syncing Google reviews:", error);
    console.error("[sync-google-reviews] Error stack:", error instanceof Error ? error.stack : "No stack");
    console.error("[sync-google-reviews] Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "An unexpected error occurred while syncing reviews.",
      },
      { status: 500 }
    );
  }
}
