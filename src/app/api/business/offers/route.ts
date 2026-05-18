import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  canCreateBusinessContent,
  canManageOwnedContent,
  canPublishContentDirectly,
} from "@/lib/auth/businessContentAccess";
import { assignOfferSlugIfMissing } from "@/lib/slug/offerSlugService";
import { formatPriceFrom } from "@/lib/formatters/format-price";
import { ensurePublishedOfferHasSlug } from "@/lib/slug/publishSlugGuards";
import { createPublishTimer, runAfterPublishResponse } from "@/server/utils/publishPipeline";
import {
  campMealKeySchema,
  campProgramTypeSchema,
  campSessionEntrySchema,
} from "@/lib/business/offerCampApiSchemas";
import { syncOfferMediaUsage } from "@/server/services/media/media-usage.service";

const createOfferSchema = z.object({
  source: z.enum(["PLACE", "EVENT"]),
  selectedPlace: z.object({
    id: z.string(),
  }).optional(),
  selectedEvent: z.object({
    id: z.string(),
  }).optional(),
  kind: z.enum(["VISIT", "CLASS", "PARTY", "EVENT_TICKET"]),
  title: z.string().min(1),
  shortDescription: z.string().min(1),
  ageMinMonths: z.number().optional(),
  ageMaxMonths: z.number().optional(),
  coverImage: z.string().optional(),
  /** Публичные URL изображений галереи (как возвращает /api/upload). */
  gallery: z.array(z.string()).optional(),
  /** Видео URL (YouTube, YouTube Shorts, Instagram Reels) */
  videoUrl: z.string().url().optional(),
  /** Акционное предложение (текстовое описание скидки и т.д.) */
  promotionalOffer: z.string().optional(),
  priceCaption: z.string().optional(),
  promotionDetails: z.string().optional(),
  pricingMode: z.enum(["SINGLE", "MULTIPLE"]),
  singlePrice: z.number().optional(),
  singlePriceLabel: z.string().optional(),
  pricingOptions: z.array(z.object({
    title: z.string(),
    price: z.number(),
    oldPrice: z.number().optional(),
    description: z.string().optional(),
  })).default([]),
  ctaType: z.enum(["BOOK", "RESERVE", "BUY_TICKET", "SEND_REQUEST", "VISIT_WEBSITE"]),
  phone: z.string().optional(),
  website: z.string().optional(),
  bookingInstructions: z.string().optional(),
  contactSource: z.enum(["manual", "place"]).optional(),
  contactPhone: z.string().optional(),
  contactWebsite: z.string().optional(),
  contactSocialLinks: z.array(
    z.object({
      id: z.string().optional(),
      network: z.enum(["instagram", "telegram", "tiktok", "youtube", "other"]),
      url: z.string(),
    }),
  ).optional(),
  status: z.enum(["DRAFT", "PENDING", "PUBLISHED"]).default("DRAFT"),
  discoverySignalIds: z.array(z.string()).default([]),
  classChipSlugs: z.array(z.string()).default([]),
  campProgramType: campProgramTypeSchema,
  // Camp fields
  campSessions: z.array(campSessionEntrySchema).optional(),
  campSessionDuration: z.string().optional(),
  campStayDuration: z.string().optional(),
  campPlacesCount: z.number().optional(),
  campGroupSize: z.number().optional(),
  campDaySchedule: z.string().optional(),
  campCanSelectDays: z.boolean().optional(),
  campHasExtendedCare: z.boolean().optional(),
  // Accommodation fields
  accommodationProvided: z.boolean().optional(),
  accommodationType: z.string().optional(),
  accommodationAddress: z.string().optional(),
  accommodationRooms: z.string().optional(),
  campIncludedMeals: z.array(campMealKeySchema).optional(),
  campSafetyInfo: z.string().optional(),
  campMedicalInfo: z.string().optional(),
  accommodationConditions: z.string().optional(),
  mealInfo: z.string().optional(),
  transferInfo: z.string().optional(),
  whatToBring: z.string().optional(),
});

// Re-trigger build for schema updates
export async function POST(request: NextRequest) {
  const timer = createPublishTimer("publish:offer");
  try {
    const user = await getCurrentUser();
    
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createOfferSchema.parse(body);
    timer.mark("validate");

    if (data.status === "PUBLISHED" && !canPublishContentDirectly(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify place access (владелец или админ/модератор)
    if (data.source === "PLACE" && data.selectedPlace) {
      const place = await prisma.place.findUnique({
        where: { id: data.selectedPlace.id },
        select: { id: true, ownerBusinessId: true },
      });

      if (!place || !place.ownerBusinessId || !canManageOwnedContent(user, place.ownerBusinessId)) {
        return NextResponse.json({ error: "Place not found" }, { status: 404 });
      }

      // Check image uniqueness within place
      if (data.coverImage) {
        const existingOfferWithCover = await prisma.offer.findFirst({
          where: {
            placeId: place.id,
            coverImage: data.coverImage,
          },
        });
        
        if (existingOfferWithCover) {
          return NextResponse.json(
            { error: "Это изображение уже используется в другом предложении" },
            { status: 400 }
          );
        }
      }
      
      // Check gallery images uniqueness (if gallery field exists in schema)
      // Note: This assumes gallery is stored as a JSON array field
      // Adjust based on actual schema implementation

      // Map offer kind to database enum
      const dbKind = data.kind === "EVENT_TICKET" ? "EVENT" : "SERVICE";

      // Calculate price fields
      let priceFrom: number | null = null;
      let priceText: string | null = null;

      if (data.pricingMode === "SINGLE" && data.singlePrice) {
        priceFrom = data.singlePrice;
        priceText = data.singlePriceLabel || null;
      } else if (data.pricingMode === "MULTIPLE" && data.pricingOptions.length > 0) {
        priceFrom = Math.min(...data.pricingOptions.map(p => p.price));
        priceText = formatPriceFrom(priceFrom);
      }

      const offer = await prisma.offer.create({
        data: {
          placeId: place.id,
          kind: dbKind,
          contactSource: data.contactSource ?? "manual",
          contactPhone: data.contactPhone,
          contactWebsite: data.contactWebsite,
          contactSocialLinks: data.contactSocialLinks as Prisma.InputJsonValue | undefined,
          title: data.title,
          description: data.shortDescription,
          coverImage: data.coverImage,
          galleryImages: data.gallery ?? [],
          videoUrl: data.videoUrl,
          priceCaption: data.priceCaption,
          promotionDetails: data.promotionDetails,
          promotionalOffer: data.promotionalOffer,
          priceFrom,
          priceText,
          ageMinMonths: data.ageMinMonths,
          ageMaxMonths: data.ageMaxMonths,
          discoverySignalIds: data.discoverySignalIds,
          classChipSlugs: data.classChipSlugs,
          status: data.status,
          campProgramType: data.campProgramType,
          // Camp fields
          campSessions: data.campSessions as unknown as Prisma.InputJsonValue,
          campSessionDuration: data.campSessionDuration,
          campStayDuration: data.campStayDuration,
          campPlacesCount: data.campPlacesCount,
          campGroupSize: data.campGroupSize,
          campDaySchedule: data.campDaySchedule,
          campCanSelectDays: data.campCanSelectDays,
          campHasExtendedCare: data.campHasExtendedCare,
          // Accommodation fields
          accommodationProvided: data.accommodationProvided,
          accommodationType: data.accommodationType,
          accommodationAddress: data.accommodationAddress,
          accommodationRooms: data.accommodationRooms,
          campIncludedMeals: data.campIncludedMeals,
          campSafetyInfo: data.campSafetyInfo,
          campMedicalInfo: data.campMedicalInfo,
          accommodationConditions: data.accommodationConditions,
          mealInfo: data.mealInfo,
          transferInfo: data.transferInfo,
          whatToBring: data.whatToBring,
          ...(data.status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
        },
        select: {
          id: true,
          title: true,
          status: true,
          slug: true,
          publishedAt: true,
        },
      });
      timer.mark("status");

      // Auto-assign slug only on first meaningful title fill (idempotent).
      if (offer.title.trim()) {
        if (offer.status === "PUBLISHED") {
          runAfterPublishResponse("publish:offer", "ensure published offer slug", () =>
            ensurePublishedOfferHasSlug(offer.id),
          );
        } else {
          runAfterPublishResponse("publish:offer", "assign draft offer slug", () =>
            assignOfferSlugIfMissing(offer.id, offer.title.trim()),
          );
        }
      }

      // Sync media usage if cover or gallery provided (don't block on errors)
      if (data.coverImage || (data.gallery && data.gallery.length > 0)) {
        try {
          await syncOfferMediaUsage(offer.id);
        } catch (error) {
          console.error(`Failed to sync media usage for offer ${offer.id}:`, error);
        }
      }

      timer.mark("response");
      timer.log({ status: offer.status });

      return NextResponse.json(offer);
    }

    // TODO: Handle EVENT source when event API is available
    return NextResponse.json({ error: "Event source not yet supported" }, { status: 400 });

  } catch (error) {
    timer.log({ error: 1 });
    console.error("Create offer error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role === "ADMIN" || user.role === "MODERATOR") {
      const offers = await prisma.offer.findMany({
        include: {
          place: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(offers);
    }

    const userPlaces = await prisma.place.findMany({
      where: { ownerBusinessId: user.id },
      select: { id: true },
    });

    const placeIds = userPlaces.map((p) => p.id);

    const offers =
      placeIds.length > 0
        ? await prisma.offer.findMany({
            where: {
              placeId: { in: placeIds },
            },
            include: {
              place: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          })
        : [];

    return NextResponse.json(offers);

  } catch (error) {
    console.error("Get offers error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
