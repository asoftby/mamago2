import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { AgePolicy, ActivityType, ContentStatus, Prisma } from "@prisma/client";
import { normalizeAgePolicy } from "@/lib/age/agePolicy";

import {
  canManageActivityById,
  coalesceActivityBusinessIdFromPlace,
} from "@/lib/auth/activityAccess";
import {
  replaceActivitySessionsFromScheduleJson,
  eventSessionScheduleFingerprint,
  eventSessionFingerprintFromStoredSessions,
} from "@/lib/business/syncEventActivitySessions";
import { syncEventVenueAndActivityCity } from "@/lib/business/syncEventVenueFromWizard";
import { computeEventShortDesc } from "@/lib/business/eventShortDesc";
import { mergeEventScheduleJson } from "@/lib/business/eventScheduleJsonMerge";
import { deleteActivity } from "@/server/services/activity.service";
import { syncEventHomeStories } from "@/server/stories/homeStoryItems";
import {
  isContentLifecycleOperationError,
  lifecycleErrorResponsePayload,
} from "@/server/services/contentLifecycleOperation.service";
import { fetchActivityEventRowSummary } from "@/lib/activity/fetchActivityEventRowSummary";
import { assignActivitySlugIfMissing } from "@/lib/slug/activitySlugService";
import { validateEventProgramCategories } from "@/lib/business/validateEventProgramCategories";
import { assertBusinessEventPrimaryCategory } from "@/lib/business/validatePrimaryEventCategory";
import {
  activityGalleryMatchesIncomingMediaIds,
  replaceActivityGalleryFromMediaIds,
} from "@/lib/business/syncEventGalleryFromMediaIds";
import { resolveCanonicalEventPublicPathById } from "@/lib/business/resolveCanonicalEventPublicPath";
import {
  type EventOrganizerInput,
  resolveEventOrganizerForPatch,
} from "@/lib/business/eventOrganizer";
import { syncActivityOccasions } from "@/lib/business/syncActivityOccasions";
import {
  getActivityOccurrenceDebugState,
  revalidateEventMutationPaths,
  resolveEventRevalidationTargets,
  resolveEventPatchRevalidateScope,
  syncActivityNextOccurrenceAt,
} from "@/lib/business/eventMutationSideEffects";
import { stableJsonStringify } from "@/lib/json/stableJsonStringify";
import { prismaBase } from "@/lib/prisma";
import { DEFAULT_ACTIVITY_FORMAT, normalizeActivityFormat } from "@/domain/activities/activity-format";
import { createRequestPerf, isServerSavePerfEnabled } from "@/server/utils/requestPerf";
import { syncActivityMediaUsage } from "@/server/services/media/media-usage.service";
import {
  findMediaAssetByReference,
  normalizeMediaDisplayUrl,
} from "@/lib/media/resolveMediaAssetReference";
import { normalizeFaqItems } from "@/lib/faq/faqItems";
import { normalizePublicationPrice } from "@/domain/pricing/normalizedPrice";
import { validateSchedulingCompleteness } from "@/lib/event/schedulingCompleteness";

/**
 * GET /api/business/events/[id]
 * Get single event by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const summary = await fetchActivityEventRowSummary(id);
    if (!summary || summary.status === "DELETED") {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    if (!(await canManageActivityById(user, id))) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const event = await prisma.activity.findFirst({
      where: {
        id,
        type: ActivityType.EVENT,
      },
      include: {
        place: {
          select: {
            id: true,
            title: true,
            formattedAddr: true,
            city: true,
          },
        },
        programCategoryLinks: {
          select: { categoryId: true },
        },
        images: {
          orderBy: {
            sortOrder: "asc",
          },
        },
        sessions: {
          orderBy: {
            startsAt: "asc",
          },
        },
        organizer: true,
        filterOptions: true,
        venue: true,
        occasionLinks: {
          select: { occasionId: true },
        },
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      event,
    });
  } catch (error: unknown) {
    console.error("Get event error:", error);
    return NextResponse.json({ error: "Failed to get event" }, { status: 500 });
  }
}

/**
 * PATCH /api/business/events/[id]
 * Update event draft
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const perf = createRequestPerf("save-event:route:update");
  const patchStarted = performance.now();
  try {
    const { id } = await params;
    perf.mark("parse-params");

    const user = await getCurrentUser();
    perf.mark("auth");

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const faqItems = body.faqItems !== undefined ? normalizeFaqItems(body.faqItems) : undefined;
    perf.mark("parse-body");

    const summary = await fetchActivityEventRowSummary(id);
    if (!summary || summary.status === "DELETED") {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    if (!(await canManageActivityById(user, id))) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }
    perf.mark("access-check");

    const existing = await prisma.activity.findFirst({
      where: {
        id,
        type: ActivityType.EVENT,
      },
      select: {
        id: true,
        title: true,
        description: true,
        businessId: true,
        cityId: true,
        nextOccurrenceAt: true,
        scheduleJson: true,
        eventCategoryId: true,
        organizerId: true,
        coverImageId: true,
        coverImageUrl: true,
        placeId: true,
        status: true,
        slug: true,
        format: true,
        ageLabel: true,
        ageMaxMonths: true,
        ageMinMonths: true,
        agePolicy: true,
        ageTags: true,
        scheduleMode: true,
        schedulingKind: true,
        priceFrom: true,
        priceTo: true,
        priceText: true,
        priceItems: true,
        currency: true,
        phone: true,
        phoneLabel: true,
        phone2: true,
        phone2Label: true,
        phone3: true,
        phone3Label: true,
        venue: {
          select: {
            kind: true,
            placeId: true,
            title: true,
            addressLine: true,
            cityId: true,
            note: true,
          },
        },
        occasionLinks: {
          select: { occasionId: true },
        },
        programCategoryLinks: {
          select: { categoryId: true },
        },
        sessions: {
          orderBy: { startsAt: "asc" },
          select: { startsAt: true },
        },
      },
    });
    perf.mark("fetch-existing");

    if (!existing) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const mergedTitle =
      typeof body.title === "string" ? body.title : existing.title;
    const mergedDescription =
      typeof body.description === "string"
        ? body.description
        : existing.description ?? "";

    const mergedPlaceId =
      typeof body.placeId === "string"
        ? body.placeId
        : body.venue?.kind === "PLACE" && typeof body.venue?.placeId === "string"
          ? body.venue.placeId
          : undefined;

    let nextBusinessId: string | null | undefined = undefined;
    if (body.businessId !== undefined) {
      nextBusinessId = body.businessId;
    }
    if (typeof mergedPlaceId === "string" && mergedPlaceId.length > 0) {
      const placeRow = await prisma.place.findUnique({
        where: { id: mergedPlaceId },
        select: { ownerBusinessId: true },
      });
      if (!placeRow) {
        return NextResponse.json({ error: "Place not found" }, { status: 404 });
      }
      if (
        body.businessId !== undefined &&
        body.businessId !== null &&
        placeRow.ownerBusinessId != null &&
        body.businessId !== placeRow.ownerBusinessId
      ) {
        return NextResponse.json(
          {
            error:
              "businessId must match the business that owns this place (Place.ownerBusinessId)",
          },
          { status: 400 },
        );
      }
      nextBusinessId = coalesceActivityBusinessIdFromPlace(
        placeRow,
        existing.businessId,
      );
    }
    perf.mark("place-check");

    // Merge, а не полная замена: неизвестные форме ключи scheduleJson
    // (legacy, импорт-метаданные) переживают пересохранение.
    let nextScheduleJson =
      body.scheduleJson !== undefined
        ? mergeEventScheduleJson(
            (existing.scheduleJson ?? {}) as Record<string, unknown>,
            (body.scheduleJson ?? {}) as Record<string, unknown>,
          )
        : ((existing.scheduleJson ?? {}) as Record<string, unknown>);

    const organizerInput =
      body.organizerInput && typeof body.organizerInput === "object"
        ? (body.organizerInput as EventOrganizerInput)
        : undefined;

    const organizerResolution = await resolveEventOrganizerForPatch(prismaBase, {
      existingOrganizerId: existing.organizerId ?? null,
      organizerInput,
    });
    perf.mark("organizer-resolve");

    if (organizerInput !== undefined) {
      nextScheduleJson = {
        ...nextScheduleJson,
        ...(organizerResolution.organizerSnapshot
          ? { organizer: organizerResolution.organizerSnapshot }
          : {}),
      };
    }

    const nextPrimaryRootCategoryId =
      typeof nextScheduleJson.categoryId === "string" ? nextScheduleJson.categoryId : null;
    const nextPrimaryLeafCategoryId =
      typeof body.eventCategoryId === "string" ? body.eventCategoryId : existing.eventCategoryId;

    assertBusinessEventPrimaryCategory({
      eventCategoryId: nextPrimaryLeafCategoryId,
      scheduleJson: nextScheduleJson,
    });

    const effectiveProgramCategoryIds =
      body.programCategoryIds !== undefined
        ? body.programCategoryIds
        : existing.programCategoryLinks.map((l) => l.categoryId);

    const { programCategoryIds } = await validateEventProgramCategories({
      primaryRootCategoryId: nextPrimaryRootCategoryId,
      primaryLeafCategoryId: nextPrimaryLeafCategoryId,
      programCategoryIds: effectiveProgramCategoryIds,
    });
    perf.mark("validate-program");

    const scheduleJsonDirty =
      stableJsonStringify(existing.scheduleJson) !== stableJsonStringify(nextScheduleJson);
    const effectiveSchedulingKind =
      body.schedulingKind === "SLOT" || body.schedulingKind === "WINDOW" || body.schedulingKind === null
        ? body.schedulingKind
        : existing.schedulingKind;
    const schedulingError = validateSchedulingCompleteness(effectiveSchedulingKind, nextScheduleJson);
    if (schedulingError) {
      return NextResponse.json({ error: schedulingError, code: "INCOMPLETE_SLOT_SCHEDULE" }, { status: 400 });
    }
    const nextScheduleFingerprint = eventSessionScheduleFingerprint(nextScheduleJson);
    const activitySessionsNeedResync =
      eventSessionScheduleFingerprint(existing.scheduleJson) !== nextScheduleFingerprint ||
      eventSessionFingerprintFromStoredSessions(existing.sessions) !== nextScheduleFingerprint;
    if (isServerSavePerfEnabled()) {
      console.info("[event-patch-timing] schedule-compare", {
        activityId: existing.id,
        durationMs: Math.round(performance.now() - patchStarted),
        scheduleJsonDirty,
        activitySessionsNeedResync,
      });
    }

    const normalizeOccasionIds = (value: unknown): string[] =>
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
    const nextOccasionIds = normalizeOccasionIds(body.occasionIds);
    const existingOccasionIds = existing.occasionLinks.map((link) => link.occasionId).sort();
    const occasionIdsChanged =
      Array.isArray(body.occasionIds) &&
      stableJsonStringify([...nextOccasionIds].sort()) !== stableJsonStringify(existingOccasionIds);

    const normalizeVenueForCompare = (
      venue: unknown,
      fallbackPlaceId: string | null | undefined,
    ) => {
      if (!venue || typeof venue !== "object") {
        return {
          kind: null,
          placeId:
            typeof fallbackPlaceId === "string" && fallbackPlaceId.trim().length > 0
              ? fallbackPlaceId.trim()
              : null,
          title: null,
          addressLine: null,
          cityId: null,
          note: null,
        };
      }

      const row = venue as {
        kind?: unknown;
        placeId?: unknown;
        title?: unknown;
        addressLine?: unknown;
        cityId?: unknown;
        note?: unknown;
      };

      return {
        kind: typeof row.kind === "string" ? row.kind : null,
        placeId:
          typeof row.placeId === "string" && row.placeId.trim().length > 0
            ? row.placeId.trim()
            : typeof fallbackPlaceId === "string" && fallbackPlaceId.trim().length > 0
              ? fallbackPlaceId.trim()
              : null,
        title: typeof row.title === "string" ? row.title : null,
        addressLine: typeof row.addressLine === "string" ? row.addressLine : null,
        cityId: typeof row.cityId === "string" ? row.cityId : null,
        note: typeof row.note === "string" ? row.note : null,
      };
    };
    const venueChanged =
      body.venue !== undefined || body.placeId !== undefined
        ? stableJsonStringify(
            normalizeVenueForCompare(body.venue, mergedPlaceId ?? existing.placeId),
          ) !==
          stableJsonStringify(
            normalizeVenueForCompare(existing.venue, existing.placeId),
          )
        : false;
    perf.mark("validate");

    const existingProgramSorted = existing.programCategoryLinks
      .map((l) => l.categoryId)
      .sort();
    const nextProgramSorted = [...programCategoryIds].sort();
    const programCategoriesChanged =
      stableJsonStringify(existingProgramSorted) !== stableJsonStringify(nextProgramSorted);

    const updateData: Prisma.ActivityUncheckedUpdateInput = {};

    const coverImageRef =
      typeof body.coverImageId === "string" ? body.coverImageId : null;
    const resolvedCoverAsset =
      body.coverImageId !== undefined ? await findMediaAssetByReference(coverImageRef) : null;
    const resolvedCoverImageId =
      body.coverImageId !== undefined
        ? resolvedCoverAsset?.id ?? null
        : existing.coverImageId;
    const resolvedCoverImageUrl =
      body.coverImageId !== undefined
        ? resolvedCoverAsset?.publicUrl ??
          normalizeMediaDisplayUrl(coverImageRef) ??
          null
        : existing.coverImageUrl;

    if (typeof body.title === "string" && body.title !== existing.title) {
      updateData.title = body.title;
    }

    if (
      typeof body.description === "string" &&
      body.description !== (existing.description ?? "")
    ) {
      updateData.description = body.description;
    }

    const shortDescNeedsRefresh =
      (typeof body.title === "string" && body.title !== existing.title) ||
      (typeof body.description === "string" &&
        body.description !== (existing.description ?? ""));

    if (shortDescNeedsRefresh) {
      updateData.shortDesc = computeEventShortDesc({
        title: mergedTitle ?? "",
        fullDescriptionHtml: mergedDescription,
      });
    }

    if (body.format !== undefined) {
      const nf = normalizeActivityFormat(body.format, DEFAULT_ACTIVITY_FORMAT);
      if (nf !== normalizeActivityFormat(existing.format, DEFAULT_ACTIVITY_FORMAT)) {
        updateData.format = nf;
      }
    }

    if (body.agePolicy !== undefined || body.ageTags !== undefined || body.ageMinMonths !== undefined || body.ageMaxMonths !== undefined) {
      const normalizedAge = normalizeAgePolicy({
        agePolicy: Object.values(AgePolicy).includes(body.agePolicy) ? body.agePolicy : existing.agePolicy,
        ageTags: body.ageTags ?? existing.ageTags,
        ageMinMonths: body.ageMinMonths !== undefined ? body.ageMinMonths : existing.ageMinMonths,
        ageMaxMonths: body.ageMaxMonths !== undefined ? body.ageMaxMonths : existing.ageMaxMonths,
      });
      updateData.agePolicy = normalizedAge.agePolicy;
      updateData.ageTags = normalizedAge.ageTags;
      updateData.ageMinMonths = normalizedAge.ageMinMonths;
      updateData.ageMaxMonths = normalizedAge.ageMaxMonths;
    }
    if (body.ageLabel !== undefined && body.ageLabel !== (existing.ageLabel ?? null)) {
      updateData.ageLabel = typeof body.ageLabel === "string" ? body.ageLabel || null : null;
    }

    if (body.scheduleMode !== undefined && body.scheduleMode !== existing.scheduleMode) {
      updateData.scheduleMode = body.scheduleMode;
    }

    if (
      body.schedulingKind !== undefined &&
      (body.schedulingKind === null || body.schedulingKind === "SLOT" || body.schedulingKind === "WINDOW") &&
      body.schedulingKind !== existing.schedulingKind
    ) {
      updateData.schedulingKind = body.schedulingKind;
    }

    if (scheduleJsonDirty) {
      updateData.scheduleJson = nextScheduleJson as Prisma.InputJsonValue;
    }

    if (
      typeof body.eventCategoryId === "string" &&
      body.eventCategoryId !== existing.eventCategoryId
    ) {
      updateData.eventCategoryId = body.eventCategoryId;
    }

    if (programCategoriesChanged) {
      updateData.programCategoryLinks = {
        deleteMany: {},
        ...(programCategoryIds.length > 0
          ? {
              createMany: {
                data: programCategoryIds.map((categoryId) => ({ categoryId })),
                skipDuplicates: true,
              },
            }
          : {}),
      };
    }

    if (
      body.priceFrom !== undefined || body.priceTo !== undefined ||
      body.priceItems !== undefined || scheduleJsonDirty
    ) {
      const normalizedPrice = normalizePublicationPrice({
        mode: nextScheduleJson.pricingMode as "free" | "fixed" | "from" | undefined,
        min: body.priceFrom !== undefined ? body.priceFrom : existing.priceFrom,
        max: body.priceTo !== undefined ? body.priceTo : existing.priceTo,
        priceItems: body.priceItems !== undefined ? body.priceItems : existing.priceItems,
        priceText: body.priceText !== undefined ? body.priceText : existing.priceText,
      });
      if (normalizedPrice.conflict) {
        return NextResponse.json({ error: "Некорректный диапазон цены", code: "INVALID_PRICE_RANGE" }, { status: 400 });
      }
      updateData.priceFrom = normalizedPrice.min;
      updateData.priceTo = normalizedPrice.max;
      updateData.priceMode = normalizedPrice.mode;
      updateData.currency = "BYN";
    }
    if (body.priceText !== undefined && body.priceText !== (existing.priceText ?? "")) {
      updateData.priceText = body.priceText;
    }
    if (body.currency !== undefined && body.currency !== existing.currency) {
      updateData.currency = body.currency;
    }
    if (body.phone !== undefined && body.phone !== (existing.phone ?? "")) {
      updateData.phone = body.phone || null;
    }
    if (body.phoneLabel !== undefined && body.phoneLabel !== existing.phoneLabel) {
      updateData.phoneLabel = body.phoneLabel || null;
    }
    if (body.phone2 !== undefined && body.phone2 !== existing.phone2) {
      updateData.phone2 = body.phone2 || null;
    }
    if (body.phone2Label !== undefined && body.phone2Label !== existing.phone2Label) {
      updateData.phone2Label = body.phone2Label || null;
    }
    if (body.phone3 !== undefined && body.phone3 !== existing.phone3) {
      updateData.phone3 = body.phone3 || null;
    }
    if (body.phone3Label !== undefined && body.phone3Label !== existing.phone3Label) {
      updateData.phone3Label = body.phone3Label || null;
    }
    if (body.priceItems !== undefined) {
      updateData.priceItems = body.priceItems ?? null;
    }
    if (faqItems !== undefined) {
      updateData.faqItems = faqItems as unknown as Prisma.InputJsonValue;
    }

    if (body.coverImageId !== undefined && resolvedCoverImageId !== existing.coverImageId) {
      updateData.coverImageId = resolvedCoverImageId;
    }
    if (body.coverImageId !== undefined && resolvedCoverImageUrl !== existing.coverImageUrl) {
      updateData.coverImageUrl = resolvedCoverImageUrl;
    }

    if (organizerResolution.organizerId !== existing.organizerId) {
      updateData.organizerId = organizerResolution.organizerId;
    }

    if (mergedPlaceId !== undefined && mergedPlaceId !== existing.placeId) {
      updateData.placeId = mergedPlaceId;
    }

    if (nextBusinessId !== undefined && nextBusinessId !== existing.businessId) {
      updateData.businessId = nextBusinessId;
    }

    let saved: {
      id: string;
      title: string | null;
      status: ContentStatus;
      slug: string | null;
      coverImageId: string | null;
    };

    const hasPrismaWrites = Object.keys(updateData).length > 0;

    if (hasPrismaWrites) {
      const activityUpdateStarted = isServerSavePerfEnabled() ? performance.now() : 0;
      saved = await prisma.activity.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          title: true,
          status: true,
          slug: true,
          coverImageId: true,
        },
      });
      if (isServerSavePerfEnabled()) {
        console.info("[event-patch-timing] activity-update", {
          activityId: id,
          durationMs: Math.round(performance.now() - activityUpdateStarted),
          hasPrismaWrites,
        });
      }
    } else {
      saved = {
        id: existing.id,
        title: existing.title,
        status: existing.status,
        slug: existing.slug,
        coverImageId: existing.coverImageId,
      };
    }
    perf.mark("prisma-update");

    let slugTouched = false;
    if (!existing.slug?.trim() && typeof mergedTitle === "string" && mergedTitle.trim()) {
      await assignActivitySlugIfMissing(saved.id, mergedTitle.trim());
      slugTouched = true;
    }
    perf.mark("slug");

    const slugRow = slugTouched
      ? await prisma.activity.findUnique({
          where: { id: saved.id },
          select: { slug: true },
        })
      : { slug: saved.slug };

    const revalidationTargetsBeforeVenueSync =
      venueChanged ? await resolveEventRevalidationTargets(saved.id) : null;

    if (activitySessionsNeedResync) {
      if (isServerSavePerfEnabled()) {
        const beforeSyncState = await getActivityOccurrenceDebugState(saved.id);
        console.info("[event-patch-debug] before sync", {
          activityId: saved.id,
          status: saved.status,
          previousNextOccurrenceAt: existing.nextOccurrenceAt,
          beforeSyncState,
        });
      }

      const sessionsSyncStarted = isServerSavePerfEnabled() ? performance.now() : 0;
      await replaceActivitySessionsFromScheduleJson({
        prisma,
        activityId: saved.id,
        scheduleJson: nextScheduleJson,
      });
      perf.mark("schedule-sync");
      const syncedNextOccurrenceAt = await syncActivityNextOccurrenceAt({
        prisma,
        activityId: saved.id,
      });
      await syncEventHomeStories(saved.id);

      if (isServerSavePerfEnabled()) {
        console.info("[event-patch-timing] activity-sessions-sync", {
          activityId: saved.id,
          durationMs: Math.round(performance.now() - sessionsSyncStarted),
        });
        console.info("[event-patch-timing] next-occurrence-sync", {
          activityId: saved.id,
          syncedNextOccurrenceAt,
        });
        const afterSyncState = await getActivityOccurrenceDebugState(saved.id);
        console.info("[event-patch-debug] after sync", {
          activityId: saved.id,
          syncedNextOccurrenceAt,
          afterSyncState,
        });
      }
    } else {
      perf.mark("schedule-sync");
    }

    let galleryTouched = false;
    if (body.galleryMediaIds !== undefined) {
      const incomingGallery = Array.isArray(body.galleryMediaIds)
        ? body.galleryMediaIds.filter(
            (mediaId: unknown): mediaId is string => typeof mediaId === "string",
          )
        : [];
      const coverForGallery =
        body.coverImageId !== undefined ? resolvedCoverImageId : saved.coverImageId;
      const galleryUnchanged = await activityGalleryMatchesIncomingMediaIds(
        saved.id,
        incomingGallery,
        coverForGallery,
      );
      if (!galleryUnchanged) {
        await replaceActivityGalleryFromMediaIds(saved.id, incomingGallery, coverForGallery);
        galleryTouched = true;
      }
      perf.mark("gallery-sync");
    } else {
      perf.mark("gallery-sync");
    }

    let venueSynced = false;
    if (venueChanged && body.venue !== undefined) {
      await syncEventVenueAndActivityCity(saved.id, body.venue, mergedPlaceId);
      venueSynced = true;
    } else if (venueChanged && body.placeId !== undefined) {
      await syncEventVenueAndActivityCity(saved.id, null, body.placeId);
      venueSynced = true;
    }
    perf.mark("venue-sync");

    const revalidationTargetsAfterVenueSync =
      venueSynced ? await resolveEventRevalidationTargets(saved.id) : null;
    const cityChanged =
      venueSynced &&
      revalidationTargetsBeforeVenueSync?.citySlug !== revalidationTargetsAfterVenueSync?.citySlug;

    let occasionsTouched = false;
    if (occasionIdsChanged) {
      await syncActivityOccasions(saved.id, nextOccasionIds);
      occasionsTouched = true;
    }
    perf.mark("occasion-sync");

    const shouldRevalidate =
      hasPrismaWrites ||
      slugTouched ||
      activitySessionsNeedResync ||
      galleryTouched ||
      venueSynced ||
      occasionsTouched;

    const revalidateScope = resolveEventPatchRevalidateScope({
      currentStatus: summary.status,
      slugChanged: slugTouched,
      cityChanged,
    });
    // Fields visible in /business/events and /business/publications/events list cards:
    // title, shortDesc (fallback subtitle from title+description), priceFrom, priceText,
    // coverImageId/coverImageUrl (denormalized cover; may affect images relation),
    // nextOccurrenceAt (from session sync), images[0] (from gallery sync),
    // place.title (from venue sync).
    const listVisibleFieldChanged =
      "title" in updateData ||
      "shortDesc" in updateData ||
      "priceFrom" in updateData ||
      "priceText" in updateData ||
      "coverImageId" in updateData ||
      "coverImageUrl" in updateData ||
      activitySessionsNeedResync ||
      galleryTouched ||
      venueSynced;

    // Explicit allowlist of Activity table fields known to be editor-only for business
    // draft PATCH. Any key in updateData NOT in this set is treated as potentially
    // list-visible → fail-safe revalidation. Add to this set only when a new field is
    // confirmed not to appear in business event list cards.
    const EDITOR_ONLY_ACTIVITY_FIELDS = new Set<string>([
      "description",          // raw HTML; always paired with shortDesc which IS list-visible
      "format",               // activity format (online/offline/hybrid), not shown in list
      "ageTags",              // age tag JSON, not shown in list
      "scheduleMode",         // schedule display mode, not shown in list
      "scheduleJson",         // schedule metadata; activitySessionsNeedResync captures date/time changes
      "eventCategoryId",      // event category, not shown in list
      "programCategoryLinks", // program category relations, not shown in list
      "priceTo",              // upper price bound, only priceFrom is shown in list
      "currency",             // currency code, not shown in list
      "organizerId",          // organizer FK, not shown in list
      "businessId",           // business FK, not shown in list
    ]);

    const changedActivityKeys = Object.keys(updateData);
    // length === 0: no Activity table writes (only side effects: occasions, gallery, sessions).
    //   List-visible impact already captured above via listVisibleFieldChanged flags.
    // every(...): all Activity writes are in the explicit editor-only allowlist.
    // Unknown key → fails every() → allChangedFieldsAreEditorOnly = false → revalidate.
    const allChangedFieldsAreEditorOnly =
      changedActivityKeys.length === 0 ||
      changedActivityKeys.every((key) => EDITOR_ONLY_ACTIVITY_FIELDS.has(key));

    // Skip business list revalidation only when all three conditions hold:
    //   1. scope is "business-save" (slug/city/status changes move to a stronger scope)
    //   2. no list-visible Activity field changed
    //   3. all changed Activity fields are in the explicit editor-only allowlist
    // Any unknown field that enters updateData triggers revalidation automatically.
    const canSkipBusinessListRevalidation =
      revalidateScope === "business-save" &&
      !listVisibleFieldChanged &&
      allChangedFieldsAreEditorOnly;

    const shouldRevalidateBusinessLists = !canSkipBusinessListRevalidation;

    let responsePublicPath: string | null = null;
    if (shouldRevalidate && shouldRevalidateBusinessLists) {
      const revalidateStarted = isServerSavePerfEnabled() ? performance.now() : 0;
      const rev = await revalidateEventMutationPaths(saved.id, revalidateScope);
      responsePublicPath = rev.publicPath;
      if (isServerSavePerfEnabled()) {
        console.info("[event-patch-timing] revalidate", {
          activityId: saved.id,
          durationMs: Math.round(performance.now() - revalidateStarted),
          revalidateScope,
          syncPaths: rev.syncPaths,
          skippedPaths: rev.skippedPaths,
          scheduledAsyncPaths: rev.scheduledAsyncPaths,
          totalRevalidateDurationMs: rev.totalDurationMs,
        });
      }
      perf.mark("revalidate");
    } else {
      perf.mark("revalidate");
      if (revalidateScope !== "business-save") {
        responsePublicPath = await resolveCanonicalEventPublicPathById(saved.id);
      }
    }

    const responsePayload = {
      success: true,
      event: {
        id: saved.id,
        title: saved.title,
        status: saved.status,
        slug: slugRow?.slug ?? null,
        publicPath: responsePublicPath,
      },
    };

    if (isServerSavePerfEnabled()) {
      const beforeResponseState = await getActivityOccurrenceDebugState(saved.id);
      console.info("[event-patch-debug] before response", {
        activityId: saved.id,
        scheduleJsonDirty,
        activitySessionsNeedResync,
        shouldRevalidate,
        revalidateScope,
        cityChanged,
        beforeResponseState,
        totalPatchMs: Math.round(performance.now() - patchStarted),
      });
    }

    perf.mark("response-sent");
    perf.log({
      eventId: saved.id,
      status: saved.status,
      revalidateScope,
      shouldRevalidate,
      listVisibleFieldChanged,
      allChangedFieldsAreEditorOnly,
      canSkipBusinessListRevalidation,
      hasPrismaWrites,
      activitySessionsNeedResync,
    });

    // Sync media usage if cover or gallery changed (don't block on errors)
    const mediaChanged = 
      (body.coverImageId !== undefined &&
        (resolvedCoverImageId !== existing.coverImageId ||
          resolvedCoverImageUrl !== existing.coverImageUrl)) ||
      galleryTouched;
    
    if (mediaChanged) {
      try {
        await syncActivityMediaUsage(saved.id);
      } catch (error) {
        console.error(`Failed to sync media usage for activity ${saved.id}:`, error);
      }
    }

    return NextResponse.json(responsePayload);
  } catch (error: unknown) {
    console.error("Update event error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/business/events/[id]
 * Hard-delete only an isolated draft event through the unified lifecycle contract.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = await fetchActivityEventRowSummary(id);
    if (!summary || summary.status === "DELETED") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (!(await canManageActivityById(user, id))) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await deleteActivity(id, user.role);
    await syncEventHomeStories(id);

    revalidatePath("/admin/moderation/events");
    revalidatePath("/admin/content/events");
    revalidatePath("/admin");

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (isContentLifecycleOperationError(error)) {
      return NextResponse.json(
        lifecycleErrorResponsePayload(error),
        { status: error.statusCode },
      );
    }
    console.error("Delete event error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
