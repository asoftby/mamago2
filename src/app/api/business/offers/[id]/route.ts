import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  canCreateBusinessContent,
  canPublishContentDirectly,
} from "@/lib/auth/businessContentAccess";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";
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

const updateOfferSchema = z.object({
  selectedPlace: z.object({
    id: z.string(),
  }).optional(),
  title: z.string().min(1).optional(),
  shortDescription: z.string().min(1).optional(),
  ageMinMonths: z.number().optional(),
  ageMaxMonths: z.number().optional(),
  coverImage: z.string().optional(),
  gallery: z.array(z.string()).optional(),
  /** Видео URL (YouTube, YouTube Shorts, Instagram Reels) */
  videoUrl: z.string().url().optional(),
  /** Акционное предложение (текстовое описание скидки и т.д.) */
  promotionalOffer: z.string().optional(),
  priceCaption: z.string().optional(),
  promotionDetails: z.string().optional(),
  pricingMode: z.enum(["SINGLE", "MULTIPLE"]).optional(),
  singlePrice: z.number().optional(),
  singlePriceLabel: z.string().optional(),
  pricingOptions: z.array(z.object({
    title: z.string(),
    price: z.number(),
    oldPrice: z.number().optional(),
    description: z.string().optional(),
  })).optional(),
  ctaType: z.enum(["BOOK", "RESERVE", "BUY_TICKET", "SEND_REQUEST", "VISIT_WEBSITE"]).optional(),
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
  status: z.enum(["DRAFT", "PENDING", "PUBLISHED"]).optional(),
  discoverySignalIds: z.array(z.string()).optional(),
  classChipSlugs: z.array(z.string()).optional(),
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
  }).nullable().optional(),
  // Camp/accommodation: null = «тип больше не лагерь, затереть в БД»
  campProgramType: campProgramTypeSchema.nullable(),
  // Camp fields
  campSessions: z.array(campSessionEntrySchema).nullable().optional(),
  campSessionDuration: z.string().nullable().optional(),
  campStayDuration: z.string().nullable().optional(),
  campPlacesCount: z.number().nullable().optional(),
  campGroupSize: z.number().nullable().optional(),
  campDaySchedule: z.string().nullable().optional(),
  campCanSelectDays: z.boolean().optional(),
  campHasExtendedCare: z.boolean().optional(),
  // Accommodation fields
  accommodationProvided: z.boolean().optional(),
  accommodationType: z.string().nullable().optional(),
  accommodationAddress: z.string().nullable().optional(),
  accommodationRooms: z.string().nullable().optional(),
  campIncludedMeals: z.array(campMealKeySchema).nullable().optional(),
  campSafetyInfo: z.string().nullable().optional(),
  campMedicalInfo: z.string().nullable().optional(),
  accommodationConditions: z.string().nullable().optional(),
  mealInfo: z.string().nullable().optional(),
  transferInfo: z.string().nullable().optional(),
  whatToBring: z.string().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const offer = await prisma.offer.findUnique({
      where: { id },
      include: {
        place: {
          select: {
            id: true,
            title: true,
            formattedAddr: true,
            customAddress: true,
            ownerBusinessId: true,
            createdByUserId: true,
          },
        },
        placements: true,
        birthdayDetails: true,
      },
    });

    if (!offer || !(await canManagePlaceAsync(user, offer.place))) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    return NextResponse.json(offer);

  } catch (error) {
    console.error("Get offer error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Re-trigger build for schema updates
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const timer = createPublishTimer("publish:offer");
  try {
    const user = await getCurrentUser();
    
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const data = updateOfferSchema.parse(body);
    timer.mark("validate");

    if (data.status === "PUBLISHED" && !canPublishContentDirectly(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existingOffer = await prisma.offer.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        kind: true,
        productType: true,
        priceFrom: true,
        priceText: true,
        campProgramType: true,
        campSessions: true,
        placeId: true,
        place: { select: { ownerBusinessId: true, createdByUserId: true } },
      },
    });

    if (!existingOffer || !(await canManagePlaceAsync(user, existingOffer.place))) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    const updateData: Prisma.OfferUpdateInput = {};

    if (data.selectedPlace?.id) {
      const nextPlace = await prisma.place.findUnique({
        where: { id: data.selectedPlace.id },
        select: { id: true, ownerBusinessId: true, createdByUserId: true },
      });

      if (!nextPlace || !(await canManagePlaceAsync(user, nextPlace))) {
        return NextResponse.json(
          { error: "Место не найдено или у вас нет прав на публикацию предложения" },
          { status: 404 },
        );
      }

      if (data.selectedPlace.id !== existingOffer.placeId) {
        updateData.place = { connect: { id: data.selectedPlace.id } };
      }
    }

    // Calculate price fields if pricing data is provided
    let priceFrom: number | null = existingOffer.priceFrom;
    let priceText: string | null = existingOffer.priceText;

    const isCampOffer =
      data.campProgramType !== undefined
        ? Boolean(data.campProgramType)
        : Boolean(existingOffer.campProgramType);
    const nextCampSessions =
      data.campSessions !== undefined ? data.campSessions : existingOffer.campSessions;

    if (isCampOffer) {
      priceFrom = getMinCampSessionPrice(nextCampSessions);
      priceText = priceFrom != null ? formatPriceFrom(priceFrom) : null;
    } else if (data.pricingMode === "SINGLE" && data.singlePrice !== undefined) {
      priceFrom = data.singlePrice;
      priceText = data.singlePriceLabel || null;
    } else if (data.pricingMode === "MULTIPLE" && data.pricingOptions && data.pricingOptions.length > 0) {
      priceFrom = Math.min(...data.pricingOptions.map(p => p.price));
      priceText = formatPriceFrom(priceFrom);
    }
    
    if (data.title !== undefined) updateData.title = data.title;
    if (data.shortDescription !== undefined) updateData.description = data.shortDescription;
    if (data.ageMinMonths !== undefined) updateData.ageMinMonths = data.ageMinMonths;
    if (data.ageMaxMonths !== undefined) updateData.ageMaxMonths = data.ageMaxMonths;
    if (data.coverImage !== undefined) updateData.coverImage = data.coverImage;
    if (data.gallery !== undefined) updateData.galleryImages = data.gallery;
    if (data.videoUrl !== undefined) updateData.videoUrl = data.videoUrl;
    if (data.priceCaption !== undefined) updateData.priceCaption = data.priceCaption;
    if (data.promotionDetails !== undefined) updateData.promotionDetails = data.promotionDetails;
    if (data.promotionalOffer !== undefined) updateData.promotionalOffer = data.promotionalOffer;
    if (data.discoverySignalIds !== undefined) updateData.discoverySignalIds = data.discoverySignalIds;
    if (data.classChipSlugs !== undefined) updateData.classChipSlugs = data.classChipSlugs;
    if (data.wizardCompletedSteps !== undefined) updateData.wizardCompletedSteps = data.wizardCompletedSteps;
    if (data.contactSource !== undefined) updateData.contactSource = data.contactSource;
    if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone;
    if (data.contactWebsite !== undefined) updateData.contactWebsite = data.contactWebsite;
    if (data.contactSocialLinks !== undefined)
      updateData.contactSocialLinks = data.contactSocialLinks as unknown as Prisma.InputJsonValue;
    if (data.campProgramType !== undefined) updateData.campProgramType = data.campProgramType;
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === "PUBLISHED") {
        updateData.publishedAt = new Date();
      }
    }
    
    // Camp fields
    if (data.campSessions !== undefined)
      updateData.campSessions =
        data.campSessions === null
          ? Prisma.DbNull
          : (data.campSessions as unknown as Prisma.InputJsonValue);
    if (data.campSessionDuration !== undefined) updateData.campSessionDuration = data.campSessionDuration;
    if (data.campStayDuration !== undefined) updateData.campStayDuration = data.campStayDuration;
    if (data.campPlacesCount !== undefined) updateData.campPlacesCount = data.campPlacesCount;
    if (data.campGroupSize !== undefined) updateData.campGroupSize = data.campGroupSize;
    if (data.campDaySchedule !== undefined) updateData.campDaySchedule = data.campDaySchedule;
    if (data.campCanSelectDays !== undefined) updateData.campCanSelectDays = data.campCanSelectDays;
    if (data.campHasExtendedCare !== undefined) updateData.campHasExtendedCare = data.campHasExtendedCare;
    
    // Accommodation fields
    if (data.accommodationProvided !== undefined) updateData.accommodationProvided = data.accommodationProvided;
    if (data.accommodationType !== undefined) updateData.accommodationType = data.accommodationType;
    if (data.accommodationAddress !== undefined) updateData.accommodationAddress = data.accommodationAddress;
    if (data.accommodationRooms !== undefined) updateData.accommodationRooms = data.accommodationRooms;
    if (data.campIncludedMeals !== undefined)
      updateData.campIncludedMeals =
        data.campIncludedMeals === null
          ? Prisma.DbNull
          : (data.campIncludedMeals as unknown as Prisma.InputJsonValue);
    if (data.campSafetyInfo !== undefined) updateData.campSafetyInfo = data.campSafetyInfo;
    if (data.campMedicalInfo !== undefined) updateData.campMedicalInfo = data.campMedicalInfo;
    if (data.accommodationConditions !== undefined) updateData.accommodationConditions = data.accommodationConditions;
    if (data.mealInfo !== undefined) updateData.mealInfo = data.mealInfo;
    if (data.transferInfo !== undefined) updateData.transferInfo = data.transferInfo;
    if (data.whatToBring !== undefined) updateData.whatToBring = data.whatToBring;

    // Не-лагерь: camp-поля из payload не применяем (strip, клиентский гейт
    // обходится); явный campProgramType: null означает смену типа CAMP → другой —
    // тогда зависшие camp-данные в БД затираются
    if (!isCampOffer) {
      const CAMP_UPDATE_KEYS = [
        "campProgramType",
        "campSessions",
        "campSessionDuration",
        "campStayDuration",
        "campPlacesCount",
        "campGroupSize",
        "campDaySchedule",
        "campCanSelectDays",
        "campHasExtendedCare",
        "accommodationProvided",
        "accommodationType",
        "accommodationAddress",
        "accommodationRooms",
        "campIncludedMeals",
        "campSafetyInfo",
        "campMedicalInfo",
        "accommodationConditions",
        "mealInfo",
        "transferInfo",
        "whatToBring",
      ] as const;
      for (const key of CAMP_UPDATE_KEYS) {
        delete updateData[key];
      }

      if (data.campProgramType === null) {
        updateData.campProgramType = null;
        updateData.campSessions = Prisma.DbNull;
        updateData.campSessionDuration = null;
        updateData.campStayDuration = null;
        updateData.campPlacesCount = null;
        updateData.campGroupSize = null;
        updateData.campDaySchedule = null;
        updateData.campCanSelectDays = false;
        updateData.campHasExtendedCare = false;
        updateData.accommodationProvided = false;
        updateData.accommodationType = null;
        updateData.accommodationAddress = null;
        updateData.accommodationRooms = null;
        updateData.campIncludedMeals = Prisma.DbNull;
        updateData.campSafetyInfo = null;
        updateData.campMedicalInfo = null;
        updateData.accommodationConditions = null;
        updateData.mealInfo = null;
        updateData.transferInfo = null;
        updateData.whatToBring = null;
      }
    }

    // Update price fields if they were recalculated
    if (priceFrom !== existingOffer.priceFrom) updateData.priceFrom = priceFrom;
    if (priceText !== existingOffer.priceText) updateData.priceText = priceText;
    const productType =
      data.productType !== undefined
        ? data.productType
        : existingOffer.productType ??
          inferOfferProductType({
            campProgramType:
              data.campProgramType !== undefined
                ? data.campProgramType
                : existingOffer.campProgramType,
            kind: existingOffer.kind,
          });
    const shouldPersistProductType =
      data.productType !== undefined || existingOffer.productType == null;

    if (shouldPersistProductType) {
      updateData.productType = productType;
      updateData.kind = mapProductTypeToLegacyKind(productType);
    }

    const offer = await prisma.$transaction(async (tx) => {
      await tx.offer.update({
        where: { id },
        data: updateData,
      });

      await syncOfferPersistenceLayer({
        db: tx,
        offerId: id,
        actorUserId: user.id,
        productType,
        requestedPlacementsStrategy: "preserve_if_missing",
        requestedPlacements: data.requestedPlacements,
        requestedPlacementsProvided: data.requestedPlacements !== undefined,
        birthdayDetails: data.birthdayDetails,
        birthdayDetailsProvided: data.birthdayDetails !== undefined,
      });

      return tx.offer.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          title: true,
          status: true,
          slug: true,
          publishedAt: true,
          updatedAt: true,
          productType: true,
          placements: true,
          birthdayDetails: true,
          place: {
            select: {
              id: true,
              title: true,
              formattedAddr: true,
              customAddress: true,
            },
          },
        },
      });
    });
    timer.mark("status");

    if (offer.status === "PUBLISHED") {
      runAfterPublishResponse("publish:offer", "ensure published offer slug", () =>
        ensurePublishedOfferHasSlug(offer.id),
      );
    } else if (
      data.title !== undefined &&
      typeof data.title === "string" &&
      data.title.trim()
    ) {
      const title = data.title.trim();
      runAfterPublishResponse("publish:offer", "assign draft offer slug", () =>
        assignOfferSlugIfMissing(offer.id, title),
      );
    }

    // Sync media usage if cover or gallery changed (don't block on errors)
    const mediaChanged = data.coverImage !== undefined || data.gallery !== undefined;
    if (mediaChanged) {
      try {
        await syncOfferMediaUsage(offer.id);
      } catch (error) {
        console.error(`Failed to sync media usage for offer ${offer.id}:`, error);
      }
    }

    timer.mark("response");
    timer.log({ status: offer.status });

    return NextResponse.json(offer);

  } catch (error) {
    timer.log({ error: 1 });
    console.error("Update offer error:", error);
    
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const offer = await prisma.offer.findFirst({
      where: {
        id,
        status: "DRAFT",
      },
      include: {
        place: { select: { ownerBusinessId: true, createdByUserId: true } },
      },
    });

    if (!offer || !(await canManagePlaceAsync(user, offer.place))) {
      return NextResponse.json(
        { error: "Offer not found or cannot be deleted" },
        { status: 404 }
      );
    }

    await prisma.offer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Delete offer error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
