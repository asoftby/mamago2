import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { AgePolicy, Prisma } from "@prisma/client";
import { normalizeAgePolicy } from "@/lib/age/agePolicy";
import {
  canCreateBusinessContent,
  canPublishContentDirectly,
} from "@/lib/auth/businessContentAccess";
import { canManagePlaceAsync, getUserBusinessId } from "@/lib/auth/placeAccess";
import { assignOfferSlugIfMissing } from "@/lib/slug/offerSlugService";
import { formatPriceFrom } from "@/lib/formatters/format-price";
import { getCampSessionPriceValues } from "@/lib/offers/campPricing";
import { normalizePublicationPrice } from "@/domain/pricing/normalizedPrice";
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
import { projectCampSessions } from "@/server/offers/campSessionProjection";
import { syncOfferMediaUsage } from "@/server/services/media/media-usage.service";
import { normalizeFaqItems } from "@/lib/faq/faqItems";
import { formatZodErrorResponse } from "@/lib/validation/zodErrorResponse";
import { shouldRejectUnlinkedPlaceForOfferMutation } from "@/lib/offers/offerLinkedBusinessAccess";

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

const partyLocationTypeSchema = z.enum(["ON_SITE", "OFF_SITE", "BOTH"]);

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
  agePolicy: z.nativeEnum(AgePolicy),
  ageMinMonths: z.number().nullable().optional(),
  ageMaxMonths: z.number().nullable().optional(),
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
  contactPhoneLabel: z.string().nullable().optional(),
  contactPhone2: z.string().nullable().optional(),
  contactPhone2Label: z.string().nullable().optional(),
  contactPhone3: z.string().nullable().optional(),
  contactPhone3Label: z.string().nullable().optional(),
  contactWebsite: z.string().optional(),
  contactSocialLinks: z.array(
    z.object({
      id: z.string().optional(),
      network: z.enum(["instagram", "telegram", "tiktok", "youtube", "other"]),
      url: z.string(),
    }),
  ).optional(),
  faqItems: z.array(z.record(z.string(), z.unknown())).nullish(),
  status: z.enum(["DRAFT", "PENDING", "PUBLISHED"]).default("DRAFT"),
  discoverySignalIds: z.array(z.string()).default([]),
  classChipSlugs: z.array(z.string()).default([]),
  /** Шаги мастера, явно завершённые пользователем */
  wizardCompletedSteps: z.array(offerWizardStepKeySchema).optional(),
  productType: offerProductTypeSchema.optional(),
  requestedPlacements: z.array(offerPlacementKeySchema).optional(),
  /** Type-specific display details (Offer.details JSONB). Validated per productType client-side. */
  details: z.record(z.string(), z.unknown()).optional(),
  // PARTY_SERVICE filterable columns (Phase 3b-2)
  category: partyCategorySchema.nullable().optional(),
  partyLocationType: partyLocationTypeSchema.nullable().optional(),
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
    const faqItems = normalizeFaqItems(data.faqItems);
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

      if (!(await canManagePlaceAsync(user, place))) {
        return NextResponse.json(
          { error: "Место не найдено" },
          { status: 404 },
        );
      }

      // Публикация business-owner оффера требует привязки места к бизнесу.
      // ADMIN / MODERATOR проходят без этого ограничения.
      if (shouldRejectUnlinkedPlaceForOfferMutation({
        role: user.role,
        status: data.status,
        ownerBusinessId: place.ownerBusinessId,
      })) {
        return NextResponse.json(
          {
            error: "Место не привязано к бизнес-профилю",
            code: "PLACE_NOT_LINKED_TO_BUSINESS",
          },
          { status: 422 },
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
      let priceTo: number | null = null;
      let priceMode: "FREE" | "EXACT" | "FROM" | "RANGE" | "UNKNOWN" = "UNKNOWN";
      let priceItems: Prisma.InputJsonValue | typeof Prisma.DbNull = Prisma.DbNull;
      let priceText: string | null = null;

      if (data.campProgramType) {
        const values = getCampSessionPriceValues(data.campSessions);
        const normalized = normalizePublicationPrice({ priceItems: values.map((price) => ({ price })) });
        priceFrom = normalized.min;
        priceTo = normalized.max;
        priceMode = normalized.mode;
        priceItems = values.map((price) => ({ price })) as Prisma.InputJsonValue;
        priceText = priceFrom != null ? formatPriceFrom(priceFrom) : null;
      } else if (data.pricingMode === "SINGLE" && data.singlePrice !== undefined) {
        const normalized = normalizePublicationPrice({ mode: "EXACT", min: data.singlePrice });
        priceFrom = normalized.min;
        priceTo = normalized.max;
        priceMode = normalized.mode;
        priceText = data.singlePriceLabel || null;
      } else if (data.pricingMode === "MULTIPLE" && data.pricingOptions.length > 0) {
        const normalized = normalizePublicationPrice({ priceItems: data.pricingOptions });
        priceFrom = normalized.min;
        priceTo = normalized.max;
        priceMode = normalized.mode;
        priceItems = data.pricingOptions as Prisma.InputJsonValue;
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
            contactPhoneLabel: data.contactPhoneLabel,
            contactPhone2: data.contactPhone2,
            contactPhone2Label: data.contactPhone2Label,
            contactPhone3: data.contactPhone3,
            contactPhone3Label: data.contactPhone3Label,
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
            priceTo,
            priceMode,
            currency: "BYN",
            priceItems,
            priceText,
            ...(() => {
              const age = normalizeAgePolicy({ agePolicy: data.agePolicy, ageMinMonths: data.ageMinMonths, ageMaxMonths: data.ageMaxMonths });
              return { agePolicy: age.agePolicy, ageMinMonths: age.ageMinMonths, ageMaxMonths: age.ageMaxMonths };
            })(),
            discoverySignalIds: data.discoverySignalIds,
            classChipSlugs: data.classChipSlugs,
            wizardCompletedSteps: data.wizardCompletedSteps ?? [],
            faqItems: faqItems as unknown as Prisma.InputJsonValue,
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
        });

        // CAMP: project campSessions JSON (canon) into queryable OfferSession rows
        if (data.campProgramType) {
          await projectCampSessions(tx, createdOffer.id, data.campSessions);
        }

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
            place: {
              select: {
                id: true,
                title: true,
                city: {
                  select: {
                    slug: true,
                  },
                },
              },
            },
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
        formatZodErrorResponse(error),
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
              city: {
                select: {
                  slug: true,
                },
              },
            },
          },
          placements: true,
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
                  city: {
                    select: {
                      slug: true,
                    },
                  },
                },
              },
              placements: true,
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
