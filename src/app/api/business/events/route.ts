import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { AgePolicy, ContentStatus, ActivityType, ScheduleMode, Prisma } from "@prisma/client";
import { normalizeAgePolicy } from "@/lib/age/agePolicy";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import {
  buildActivityManageWhereForUser,
  coalesceActivityBusinessIdFromPlace,
  getBusinessIdsUserCanAccess,
} from "@/lib/auth/activityAccess";
import { getUserBusinessId } from "@/lib/auth/placeAccess";
import { replaceActivitySessionsFromScheduleJson } from "@/lib/business/syncEventActivitySessions";
import { syncEventVenueAndActivityCity } from "@/lib/business/syncEventVenueFromWizard";
import { computeEventShortDesc } from "@/lib/business/eventShortDesc";
import {
  businessEventListViewWhere,
  excludeGhostEventDrafts,
  normalizeBusinessEventListView,
} from "@/lib/business/eventListWhere";
import { validateEventProgramCategories } from "@/lib/business/validateEventProgramCategories";
import { assertBusinessEventPrimaryCategory } from "@/lib/business/validatePrimaryEventCategory";
import { assignActivitySlugIfMissing } from "@/lib/slug/activitySlugService";
import { replaceActivityGalleryFromMediaIds } from "@/lib/business/syncEventGalleryFromMediaIds";
import { resolveEventOrganizer } from "@/lib/business/eventOrganizer";
import { syncActivityOccasions } from "@/lib/business/syncActivityOccasions";
import {
  revalidateEventMutationPaths,
  syncActivityNextOccurrenceAt,
} from "@/lib/business/eventMutationSideEffects";
import { prismaBase } from "@/lib/prisma";
import { DEFAULT_ACTIVITY_FORMAT, normalizeActivityFormat } from "@/domain/activities/activity-format";
import { validateEventSignals } from "@/lib/event/eventSignalMapping";
import { createRequestPerf } from "@/server/utils/requestPerf";
import { syncActivityMediaUsage } from "@/server/services/media/media-usage.service";
import {
  findMediaAssetByReference,
  normalizeMediaDisplayUrl,
} from "@/lib/media/resolveMediaAssetReference";
import { normalizeFaqItems } from "@/lib/faq/faqItems";
import { validateSchedulingCompleteness } from "@/lib/event/schedulingCompleteness";
import { normalizePublicationPrice } from "@/domain/pricing/normalizedPrice";

/**
 * POST /api/business/events
 * Create new event (draft)
 */
export async function POST(request: NextRequest) {
  const perf = createRequestPerf("save-event:route:create");
  try {
    const user = await getCurrentUser();
    perf.mark("auth");

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const normalizedAge = normalizeAgePolicy({
      agePolicy: Object.values(AgePolicy).includes(body.agePolicy) ? body.agePolicy : AgePolicy.UNKNOWN,
      ageTags: Array.isArray(body.ageTags) ? body.ageTags : [],
      ageMinMonths: typeof body.ageMinMonths === "number" ? body.ageMinMonths : null,
      ageMaxMonths: typeof body.ageMaxMonths === "number" ? body.ageMaxMonths : null,
    });
    const faqItems = normalizeFaqItems(body.faqItems);
    perf.mark("parse");

    const title = typeof body.title === "string" && body.title.trim() ? body.title : "Новое событие";
    const description = typeof body.description === "string" ? body.description : "";

    const mergedPlaceId =
      typeof body.placeId === "string"
        ? body.placeId
        : body.venue?.kind === "PLACE" && typeof body.venue?.placeId === "string"
          ? body.venue.placeId
          : undefined;

    const scheduleJsonUnknown =
      (body.scheduleJson && typeof body.scheduleJson === "object")
        ? (body.scheduleJson as Record<string, unknown>)
        : {};
    const organizerResolution =
      body.organizerInput && typeof body.organizerInput === "object"
        ? await resolveEventOrganizer(prismaBase, body.organizerInput)
        : { organizerId: typeof body.organizerId === "string" ? body.organizerId : null, organizerSnapshot: null };
    const scheduleJsonWithOrganizer: Record<string, unknown> = {
      ...scheduleJsonUnknown,
      ...(organizerResolution.organizerSnapshot
        ? { organizer: organizerResolution.organizerSnapshot }
        : {}),
    };
    const normalizedPrice = normalizePublicationPrice({
      mode: scheduleJsonWithOrganizer.pricingMode as "free" | "fixed" | "from" | undefined,
      min: body.priceFrom,
      max: body.priceTo,
      priceItems: body.priceItems,
      priceText: body.priceText,
    });
    if (normalizedPrice.conflict) {
      return NextResponse.json({ error: "Некорректный диапазон цены", code: "INVALID_PRICE_RANGE" }, { status: 400 });
    }
    const requestedSchedulingKind =
      body.schedulingKind === "SLOT" || body.schedulingKind === "WINDOW"
        ? body.schedulingKind
        : null;
    const schedulingError = validateSchedulingCompleteness(requestedSchedulingKind, scheduleJsonWithOrganizer);
    if (schedulingError) {
      return NextResponse.json({ error: schedulingError, code: "INCOMPLETE_SLOT_SCHEDULE" }, { status: 400 });
    }
    const primaryRootCategoryId =
      typeof scheduleJsonWithOrganizer.categoryId === "string" ? scheduleJsonWithOrganizer.categoryId : null;
    const primaryLeafCategoryId =
      typeof body.eventCategoryId === "string" ? body.eventCategoryId : null;

    assertBusinessEventPrimaryCategory({
      eventCategoryId: primaryLeafCategoryId,
      scheduleJson: scheduleJsonUnknown,
    });

    const { programCategoryIds } = await validateEventProgramCategories({
      primaryRootCategoryId,
      primaryLeafCategoryId,
      programCategoryIds: body.programCategoryIds,
    });

    // Validate and process discovery signals
    let discoverySignalIds: string[] = [];
    if (Array.isArray(body.discoverySignalIds) && body.discoverySignalIds.length > 0) {
      const signalIds = body.discoverySignalIds.filter((id: unknown): id is string => typeof id === "string");
      
      // Validate signals
      const validation = await validateEventSignals(signalIds, prisma);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error || "Invalid signals" },
          { status: 400 }
        );
      }
      
      // Remove duplicates
      discoverySignalIds = Array.from(new Set(signalIds));
    }
    perf.mark("validate");

    const coverImageRef =
      typeof body.coverImageId === "string" ? body.coverImageId : null;
    const resolvedCoverAsset = await findMediaAssetByReference(coverImageRef);
    const resolvedCoverImageId = resolvedCoverAsset?.id ?? null;
    const resolvedCoverImageUrl =
      resolvedCoverAsset?.publicUrl ??
      normalizeMediaDisplayUrl(coverImageRef) ??
      null;
    perf.mark("resolve-media");

    // Process genre slugs
    const genreSlugs: string[] = [];
    if (Array.isArray(body.genreSlugs)) {
      for (const slug of body.genreSlugs) {
        if (typeof slug === "string" && genreSlugs.length < 3) {
          genreSlugs.push(slug);
        }
      }
    }

    let resolvedBusinessId: string | null =
      typeof body.businessId === "string" ? body.businessId : null;

    if (typeof mergedPlaceId === "string" && mergedPlaceId.length > 0) {
      const placeRow = await prisma.place.findUnique({
        where: { id: mergedPlaceId },
        select: { ownerBusinessId: true },
      });
      if (!placeRow) {
        return NextResponse.json(
          { error: "Place not found" },
          { status: 404 },
        );
      }
      resolvedBusinessId = coalesceActivityBusinessIdFromPlace(
        placeRow,
        resolvedBusinessId,
      );
    } else if (!resolvedBusinessId) {
      resolvedBusinessId = await getUserBusinessId(user.id);
    }

    // Create event as draft
    const event = await prisma.activity.create({
      data: {
        type: ActivityType.EVENT,
        status: ContentStatus.DRAFT,
        ownerUserId: user.id,
        
        // Basic info
        title,
        format: normalizeActivityFormat(body.format, DEFAULT_ACTIVITY_FORMAT),
        shortDesc: computeEventShortDesc({ title, fullDescriptionHtml: description }),
        description,
        
        // Age
        ageLabel: typeof body.ageLabel === "string" ? body.ageLabel || null : null,
        agePolicy: normalizedAge.agePolicy,
        ageMinMonths: normalizedAge.ageMinMonths,
        ageMaxMonths: normalizedAge.ageMaxMonths,
        ageTags: normalizedAge.ageTags,
        
        // Schedule
        scheduleMode: ScheduleMode.MULTI_DATE,
        schedulingKind: requestedSchedulingKind,
        scheduleJson: scheduleJsonWithOrganizer as Prisma.InputJsonValue,
        
        // Event category (leaf: subcategory if selected, otherwise root)
        eventCategoryId:
          typeof body.eventCategoryId === "string" ? body.eventCategoryId : undefined,
        // Genre slugs (max 3)
        genreSlugs,
        // Discovery signals
        discoverySignalIds,
        programCategoryLinks:
          programCategoryIds.length > 0
            ? {
                createMany: {
                  data: programCategoryIds.map((categoryId) => ({ categoryId })),
                  skipDuplicates: true,
                },
              }
            : undefined,

        // Pricing
        priceFrom: normalizedPrice.min,
        priceTo: normalizedPrice.max,
        priceMode: normalizedPrice.mode,
        priceText: body.priceText,
        currency: body.currency || "BYN",
        priceItems: body.priceItems as Prisma.InputJsonValue | undefined,
        faqItems: faqItems as unknown as Prisma.InputJsonValue,

        // Contact phones
        phone: typeof body.phone === "string" ? body.phone || null : null,
        phoneLabel: typeof body.phoneLabel === "string" ? body.phoneLabel || null : null,
        phone2: typeof body.phone2 === "string" ? body.phone2 || null : null,
        phone2Label: typeof body.phone2Label === "string" ? body.phone2Label || null : null,
        phone3: typeof body.phone3 === "string" ? body.phone3 || null : null,
        phone3Label: typeof body.phone3Label === "string" ? body.phone3Label || null : null,
        
        // Images
        coverImageId: resolvedCoverImageId,
        coverImageUrl: resolvedCoverImageUrl,
        
        // Location
        ...(mergedPlaceId !== undefined ? { placeId: mergedPlaceId } : {}),
        
        // Business
        businessId: resolvedBusinessId,
        organizerId: organizerResolution.organizerId,
      },
    });
    perf.mark("write");

    await replaceActivitySessionsFromScheduleJson({
      prisma,
      activityId: event.id,
      scheduleJson: event.scheduleJson,
    });
    perf.mark("schedule-sync");
    await syncActivityNextOccurrenceAt({ prisma, activityId: event.id });
    await replaceActivityGalleryFromMediaIds(
      event.id,
      Array.isArray(body.galleryMediaIds) ? body.galleryMediaIds.filter((id: unknown): id is string => typeof id === "string") : [],
      resolvedCoverImageId,
    );
    perf.mark("gallery-sync");
    if (body.venue !== undefined) {
      await syncEventVenueAndActivityCity(
        event.id,
        body.venue,
        mergedPlaceId,
      );
    } else if (mergedPlaceId !== undefined) {
      await syncEventVenueAndActivityCity(event.id, null, mergedPlaceId);
    }
    perf.mark("venue-sync");

    // Sync occasion links
    const occasionIds = Array.isArray(body.occasionIds)
      ? body.occasionIds.filter((id: unknown): id is string => typeof id === "string")
      : [];
    if (occasionIds.length > 0) {
      await syncActivityOccasions(event.id, occasionIds);
    }
    perf.mark("occasion-sync");

    await assignActivitySlugIfMissing(event.id, title);
    perf.mark("slug");

    const slugRow = await prisma.activity.findUnique({
      where: { id: event.id },
      select: { slug: true },
    });

    const { publicPath } = await revalidateEventMutationPaths(event.id, "business-save");
    perf.mark("revalidate");

    // Sync media usage (don't block on errors)
    try {
      await syncActivityMediaUsage(event.id);
    } catch (error) {
      console.error(`Failed to sync media usage for activity ${event.id}:`, error);
    }

    perf.mark("response");
    perf.log({ eventId: event.id, status: event.status });

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        title: event.title,
        status: event.status,
        slug: slugRow?.slug ?? null,
        publicPath,
      },
    });
  } catch (error: unknown) {
    console.error("Create event error:", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}

/**
 * GET /api/business/events
 * List user's events
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const manageWhere =
      user.role === "ADMIN" || user.role === "MODERATOR"
        ? {}
        : buildActivityManageWhereForUser(
            user.id,
            await getBusinessIdsUserCanAccess(user.id),
          );
    const view = normalizeBusinessEventListView(
      request.nextUrl.searchParams.get("view"),
    );

    const events = await prisma.activity.findMany({
      where: {
        type: ActivityType.EVENT,
        ...manageWhere,
        ...businessEventListViewWhere(view),
        ...excludeGhostEventDrafts(),
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        place: {
          select: {
            id: true,
            title: true,
          },
        },
        images: true,
        sessions: {
          orderBy: {
            startsAt: "asc",
          },
          take: 1,
        },
      },
    });

    return NextResponse.json({
      success: true,
      events,
    });
  } catch (error: unknown) {
    console.error("List events error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
