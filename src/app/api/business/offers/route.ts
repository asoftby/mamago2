import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  canCreateBusinessContent,
  canPublishContentDirectly,
} from "@/lib/auth/businessContentAccess";
import { canManagePlaceAsync, getUserBusinessId } from "@/lib/auth/placeAccess";
import { assignOfferSlugIfMissing } from "@/lib/slug/offerSlugService";
import { formatPriceFrom } from "@/lib/formatters/format-price";
import { getMinCampSessionPrice } from "@/lib/offers/campPricing";
import { ensurePublishedOfferHasSlug } from "@/lib/slug/publishSlugGuards";
import { createPublishTimer, runAfterPublishResponse } from "@/server/utils/publishPipeline";
import {
  campMealKeySchema,
  campProgramTypeSchema,
  campSessionEntrySchema,
  offerWizardStepKeySchema,
} from "@/lib/business/offerCampApiSchemas";
import {
  inferOfferProductType,
  mapProductTypeToLegacyKind,
} from "@/lib/offers/offerPersistenceCompatibility";
import { syncOfferPersistenceLayer } from "@/server/offers/offerPersistence";
import { syncOfferMediaUsage } from "@/server/services/media/media-usage.service";

const offerProductTypeSchema = z.enum([
  "PLACE_VISIT",
  "ONE_TIME_ACTIVITY",
  "REGULAR_ACTIVITY",
  "CAMP",
  "PARTY_SERVICE",
  "PARTY_PACKAGE",
]);

const offerPlacementKeySchema = z.enum([
  "WHERE_TO_GO",
  "CLASSES",
  "CAMPS",
  "BIRTHDAY",
]);

const birthdayRoleSchema = z.enum([
  "VENUE",
  "ANIMATOR",
  "SHOW",
  "MASTER_CLASS",
  "CAKE",
  "CATERING",
  "DECOR",
  "PHOTO_VIDEO",
  "PACKAGE",
  "OTHER",
]);

const birthdayLocationTypeSchema = z.enum(["ON_SITE", "OFF_SITE", "BOTH"]);

const partyCategorySchema = z.enum([
  "VENUE", "ANIMATOR", "SHOW", "MASTER_CLASS", "CAKE", "FOOD", "DECOR", "PHOTO", "PROGRAM", "OTHER",
]);

const partyOccasionSchema = z.enum(["BIRTHDAY", "GRADUATION"]);

const createOfferSchema = z.object({
  source: z.enum(["PLACE", "EVENT"]),
  /** Идемпотентность create (повтор после таймаута / double-click) */
  createRequestId: z.string().max(64).optional(),
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
  /** Шаги мастера, явно завершённые пользователем */
  wizardCompletedSteps: z.array(offerWizardStepKeySchema).optional(),
  productType: offerProductTypeSchema.optional(),
  requestedPlacements: z.array(offerPlacementKeySchema).optional(),
  birthdayDetails: z.object({
    role: birthdayRoleSchema.nullable().optional(),
    locationType: birthdayLocationTypeSchema.nullable().optional(),
    durationMinutes: z.number().int().nullable().optional(),
    minChildren: z.number().int().nullable().optional(),
    maxChildren: z.number().int().nullable().optional(),
    priceFrom: z.number().nullable().optional(),
    included: z.string().nullable().optional(),
    program: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
  }).optional(),
  /** Type-specific display details (Offer.details JSONB). Validated per productType client-side. */
  details: z.record(z.string(), z.unknown()).optional(),
  // PARTY_SERVICE filterable columns (Phase 3b-2)
  category: partyCategorySchema.nullable().optional(),
  partyLocationType: birthdayLocationTypeSchema.nullable().optional(),
  minChildren: z.number().int().nullable().optional(),
  maxChildren: z.number().int().nullable().optional(),
  occasions: z.array(partyOccasionSchema).optional(),
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

    // Идемпотентность: повтор запроса с тем же createRequestId возвращает уже созданный оффер
    const idempotencyKey = data.createRequestId
      ? `${user.id}:${data.createRequestId}`
      : null;
    if (idempotencyKey) {
      const existing = await prisma.offer.findUnique({
        where: { createRequestId: idempotencyKey },
        select: { id: true, title: true, status: true, slug: true, publishedAt: true },
      });
      if (existing) {
        timer.mark("response");
        timer.log({ status: existing.status, idempotent: 1 });
        return NextResponse.json(existing);
      }
    }

    // Verify place access (владелец или админ/модератор)
    if (data.source === "PLACE" && data.selectedPlace) {
      const place = await prisma.place.findUnique({
        where: { id: data.selectedPlace.id },
        select: { id: true, ownerBusinessId: true, createdByUserId: true },
      });

      if (!place) {
        return NextResponse.json(
          { error: "Место не найдено" },
          { status: 404 },
        );
      }

      // Место существует, но не привязано к бизнес-профилю: оффер требует привязки.
      // Подсказку показываем только создателю места — остальным не раскрываем существование.
      if (!place.ownerBusinessId && place.createdByUserId === user.id) {
        return NextResponse.json(
          {
            error: "Место не привязано к бизнес-профилю",
            code: "PLACE_NOT_LINKED_TO_BUSINESS",
          },
          { status: 422 },
        );
      }

      if (!(await canManagePlaceAsync(user, place))) {
        return NextResponse.json(
          { error: "Место не найдено" },
          { status: 404 },
        );
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

      const productType =
        data.productType ??
        (data.campProgramType
          ? "CAMP"
          : data.kind === "EVENT_TICKET"
            ? "ONE_TIME_ACTIVITY"
            : data.kind === "CLASS"
              ? "REGULAR_ACTIVITY"
              : inferOfferProductType({ kind: "SERVICE" }));
      const dbKind = mapProductTypeToLegacyKind(productType);

      // Calculate price fields
      let priceFrom: number | null = null;
      let priceText: string | null = null;

      const campPriceFrom = data.campProgramType
        ? getMinCampSessionPrice(data.campSessions)
        : null;

      if (data.campProgramType) {
        priceFrom = campPriceFrom;
        priceText = campPriceFrom != null ? formatPriceFrom(campPriceFrom) : null;
      } else if (data.pricingMode === "SINGLE" && data.singlePrice !== undefined) {
        priceFrom = data.singlePrice;
        priceText = data.singlePriceLabel || null;
      } else if (data.pricingMode === "MULTIPLE" && data.pricingOptions.length > 0) {
        priceFrom = Math.min(...data.pricingOptions.map(p => p.price));
        priceText = formatPriceFrom(priceFrom);
      }

      const offer = await prisma.$transaction(async (tx) => {
        const createdOffer = await tx.offer.create({
          data: {
            placeId: place.id,
            createRequestId: idempotencyKey ?? undefined,
            kind: dbKind,
            productType,
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
            wizardCompletedSteps: data.wizardCompletedSteps ?? [],
            details: data.details as Prisma.InputJsonValue | undefined,
            // PARTY_SERVICE/PARTY_PACKAGE: write filterable fields to Offer columns
            ...(productType === "PARTY_SERVICE" || productType === "PARTY_PACKAGE" ? {
              category: data.category ?? undefined,
              partyLocationType: data.partyLocationType ?? undefined,
              minChildren: data.minChildren ?? undefined,
              maxChildren: data.maxChildren ?? undefined,
              occasions: data.occasions ?? [],
            } : {}),
            status: data.status,
            ...(data.campProgramType
              ? {
                  campProgramType: data.campProgramType,
                  campSessions: data.campSessions as unknown as Prisma.InputJsonValue,
                  campSessionDuration: data.campSessionDuration,
                  campStayDuration: data.campStayDuration,
                  campPlacesCount: data.campPlacesCount,
                  campGroupSize: data.campGroupSize,
                  campDaySchedule: data.campDaySchedule,
                  campCanSelectDays: data.campCanSelectDays,
                  campHasExtendedCare: data.campHasExtendedCare,
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
                }
              : {}),
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

        await syncOfferPersistenceLayer({
          db: tx,
          offerId: createdOffer.id,
          actorUserId: user.id,
          productType,
          requestedPlacements: data.requestedPlacements,
          birthdayDetails: data.birthdayDetails,
        });

        return tx.offer.findUniqueOrThrow({
          where: { id: createdOffer.id },
          select: {
            id: true,
            title: true,
            status: true,
            slug: true,
            publishedAt: true,
            productType: true,
            placements: true,
            birthdayDetails: true,
          },
        });
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
          placements: true,
          birthdayDetails: true,
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(offers);
    }

    const businessId = await getUserBusinessId(user.id);
    const userPlaces = await prisma.place.findMany({
      where: {
        OR: [
          { createdByUserId: user.id },
          ...(businessId ? [{ ownerBusinessId: businessId }] : []),
        ],
      },
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
              placements: true,
              birthdayDetails: true,
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
