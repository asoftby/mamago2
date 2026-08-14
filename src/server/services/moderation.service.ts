import prisma, { prismaBase, searchIndexer } from "@/lib/prisma";
import { ContentStatus, ModerationEntityType, ModerationAction, Prisma } from "@prisma/client";
import { createPublishTimer } from "@/server/utils/publishPipeline";

/**
 * Log a moderation action
 */
export async function logModeration(
  entityType: ModerationEntityType,
  entityId: string,
  action: ModerationAction,
  message: string | null,
  reviewedByUserId: string | null
): Promise<void> {
  await prisma.moderationLog.create({
    data: {
      entityType,
      entityId,
      action,
      message,
      reviewedByUserId,
    },
  });
}

/**
 * Get moderation logs for an entity
 */
export async function getModerationLogs(
  entityType: ModerationEntityType,
  entityId: string
) {
  return prisma.moderationLog.findMany({
    where: {
      entityType,
      entityId,
    },
    include: {
      reviewedBy: {
        select: {
          id: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Get the latest moderation message for an entity
 */
export async function getLatestModerationMessage(
  entityType: ModerationEntityType,
  entityId: string
): Promise<string | null> {
  const latestLog = await prisma.moderationLog.findFirst({
    where: {
      entityType,
      entityId,
      message: { not: null },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      message: true,
    },
  });

  return latestLog?.message || null;
}

/**
 * Approve a Place
 * Changes status from PENDING to PUBLISHED
 * Sends notification to owner.
 */
export interface ApprovedPlaceResult {
  id: string;
  status: ContentStatus;
  slug: string | null;
  updatedAt: Date;
}

export async function approvePlace(
  placeId: string,
  reviewedByUserId: string,
  message?: string
): Promise<ApprovedPlaceResult> {
  const timer = createPublishTimer("publish:place");
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { status: true, title: true, createdByUserId: true, slug: true },
  });

  if (!place) throw new Error("Place not found");
  if (place.status !== "PENDING") throw new Error(`Cannot approve from status: ${place.status}`);

  // EVENT_SEARCH_INDEX_PUBLICATION_RACE fix: this status update and the
  // slug assignment below are two sequential writes to the same row. Using
  // prismaBase (no search-indexing extension) here means neither one
  // independently dispatches a fire-and-forget reindex reading an
  // intermediate (published-but-no-slug) snapshot — only the single,
  // explicitly awaited upsertPlace() call below ever indexes this Place for
  // this operation, always reading the final, fully-published state.
  await prismaBase.$transaction([
    prismaBase.place.update({ where: { id: placeId }, data: { status: "PUBLISHED" } }),
    prismaBase.moderationLog.create({
      data: { entityType: "PLACE", entityId: placeId, action: "APPROVE", message: message || "Approved", reviewedByUserId },
    }),
  ]);
  timer.mark("status");

  if (!place.slug) {
    const { assignSlugOnPublish } = await import("@/lib/slug/placeSlugService");
    await assignSlugOnPublish(placeId);
  }
  timer.mark("response");

  // Single deterministic, awaited final reindex — the caller only gets a
  // result after the search document reflects the final published state.
  await searchIndexer.upsertPlaceStrict(placeId);
  timer.log({ status: "PUBLISHED", flow: "admin-approve" });

  // Notify creator (outside transaction, non-blocking). The import itself
  // (not just the call) is wrapped, so a notification-layer failure never
  // fails the publish operation — same resilience the call below already
  // had via .catch(), just extended to cover the import step too.
  try {
    const { notifyPlaceApproved } = await import("./notification.service");
    notifyPlaceApproved(placeId, place.title, place.createdByUserId).catch((e) =>
      console.error("[moderation] notifyPlaceApproved failed:", e),
    );
  } catch (e) {
    console.error("[moderation] notifyPlaceApproved import failed:", e);
  }

  const published = await prismaBase.place.findUniqueOrThrow({
    where: { id: placeId },
    select: { id: true, status: true, slug: true, updatedAt: true },
  });
  return published;
}

export async function needsRevisionPlace(
  placeId: string,
  reviewedByUserId: string,
  message: string
): Promise<void> {
  if (!message?.trim()) throw new Error("Message is required for NEEDS_REVISION status");

  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { status: true, title: true, createdByUserId: true },
  });

  if (!place) throw new Error("Place not found");
  if (place.status !== "PENDING") throw new Error(`Cannot request changes from status: ${place.status}`);

  await prisma.$transaction([
    prisma.place.update({ where: { id: placeId }, data: { status: "NEEDS_REVISION" } }),
    prisma.moderationLog.create({
      data: { entityType: "PLACE", entityId: placeId, action: "NEEDS_REVISION", message, reviewedByUserId },
    }),
  ]);

  const { notifyPlaceNeedsChanges } = await import("./notification.service");
  notifyPlaceNeedsChanges(placeId, place.title, place.createdByUserId, message).catch((e) =>
    console.error("[moderation] notifyPlaceNeedsChanges failed:", e),
  );
}

export async function rejectPlace(
  placeId: string,
  reviewedByUserId: string,
  message: string
): Promise<void> {
  if (!message?.trim()) throw new Error("Message is required for REJECTED status");

  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { status: true, title: true, createdByUserId: true },
  });

  if (!place) throw new Error("Place not found");
  if (place.status !== "PENDING") throw new Error(`Cannot reject from status: ${place.status}`);

  await prisma.$transaction([
    prisma.place.update({ where: { id: placeId }, data: { status: "REJECTED" } }),
    prisma.moderationLog.create({
      data: { entityType: "PLACE", entityId: placeId, action: "REJECT", message, reviewedByUserId },
    }),
  ]);

  const { notifyPlaceRejected } = await import("./notification.service");
  notifyPlaceRejected(placeId, place.title, place.createdByUserId, message).catch((e) =>
    console.error("[moderation] notifyPlaceRejected failed:", e),
  );
}

/**
 * Submit a Place for initial moderation
 * Changes status from DRAFT, NEEDS_REVISION, or REJECTED to PENDING
 * 
 * Note: For post-publication edits, use PlaceRevision flow instead
 */
export async function submitPlace(
  placeId: string,
  _actingUserId: string
): Promise<void> {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { status: true, createdByUserId: true },
  });

  if (!place) {
    throw new Error("Place not found");
  }

  // Access control is enforced by API routes (owner or admin/moderator).

  if (
    place.status !== "DRAFT" &&
    place.status !== "NEEDS_REVISION" &&
    place.status !== "REJECTED"
  ) {
    throw new Error(`Cannot submit from status: ${place.status}`);
  }

  // Prepare update data
  const updateData: Prisma.PlaceUpdateInput = {
    status: "PENDING" as ContentStatus,
  };

  // If resubmitting after NEEDS_REVISION, set revisionResubmittedAt
  if (place.status === "NEEDS_REVISION") {
    updateData.revisionResubmittedAt = new Date();
  }

  await prisma.$transaction([
    // Update place status
    prisma.place.update({
      where: { id: placeId },
      data: updateData,
    }),

    // Log moderation action
    prisma.moderationLog.create({
      data: {
        entityType: "PLACE",
        entityId: placeId,
        action: "SUBMIT",
        message: place.status === "NEEDS_REVISION" 
          ? "Resubmitted after revision" 
          : "Submitted for moderation",
        reviewedByUserId: null,
      },
    }),
  ]);
}

/**
 * Publish a Place from draft/revision/rejected without moderation queue (admin flow).
 */
export async function publishPlaceFromDraft(
  placeId: string,
  publishedByUserId: string,
): Promise<void> {
  const timer = createPublishTimer("publish:place");
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { status: true, createdByUserId: true, slug: true },
  });

  if (!place) {
    throw new Error("Place not found");
  }

  if (
    place.status !== "DRAFT" &&
    place.status !== "NEEDS_REVISION" &&
    place.status !== "REJECTED"
  ) {
    throw new Error(`Cannot publish from status: ${place.status}`);
  }

  await prisma.$transaction([
    prisma.place.update({
      where: { id: placeId },
      data: {
        status: "PUBLISHED",
      },
    }),
    prisma.moderationLog.create({
      data: {
        entityType: "PLACE",
        entityId: placeId,
        action: "APPROVE",
        message: "Опубликовано администратором",
        reviewedByUserId: publishedByUserId,
      },
    }),
  ]);
  timer.mark("status");

  const { assignSlugOnPublish } = await import("@/lib/slug/placeSlugService");
  if (!place.slug) {
    await assignSlugOnPublish(placeId);
  }
  timer.mark("response");
  timer.log({ status: "PUBLISHED", flow: "direct" });
}

export async function approveActivity(
  activityId: string,
  reviewedByUserId: string,
  message?: string
): Promise<void> {
  const timer = createPublishTimer("publish:event");
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { status: true, title: true, businessId: true, scheduleJson: true, ownerUserId: true, slug: true },
  });

  if (!activity) throw new Error("Activity not found");
  if (activity.status !== "PENDING" && activity.status !== "PENDING_UPDATE") {
    throw new Error(`Cannot approve from status: ${activity.status}`);
  }

  const scheduleJson =
    activity.scheduleJson && typeof activity.scheduleJson === "object" && !Array.isArray(activity.scheduleJson)
      ? (activity.scheduleJson as Record<string, unknown>)
      : {};

  const { resolvePendingLocationOnPublish } = await import("@/lib/business/resolvePendingLocationOnPublish");

  // EVENT_SEARCH_INDEX_PUBLICATION_RACE fix: this transaction (status
  // update, and any Place created for a pending location) and the slug
  // assignment below are multiple sequential writes to the same Activity
  // (and possibly a new Place). Using prismaBase (no search-indexing
  // extension) here means none of these intermediate writes independently
  // dispatches a fire-and-forget reindex reading a stale (e.g.
  // published-but-no-slug) snapshot — only the explicitly awaited final
  // upsert calls below ever index these rows for this operation.
  const { placeId: resolvedPlaceId, placeCreated, updatedScheduleJson } =
    await prismaBase.$transaction(async (tx) => {
      const result = await resolvePendingLocationOnPublish(
        tx,
        activityId,
        scheduleJson,
        activity.ownerUserId,
        activity.businessId ?? null,
      );

      await tx.activity.update({
        where: { id: activityId },
        data: {
          status: "PUBLISHED",
          scheduleJson: result.updatedScheduleJson as never,
          ...(result.placeId !== null ? { placeId: result.placeId } : {}),
        },
      });

      await tx.moderationLog.create({
        data: {
          entityType: "ACTIVITY",
          entityId: activityId,
          action: "APPROVE",
          message: message || "Approved",
          reviewedByUserId,
        },
      });

      return result;
    });
  timer.mark("status");

  // Назначаем slug новому Place (вне транзакции — идемпотентно)
  if (placeCreated && resolvedPlaceId) {
    const { assignSlugOnPublish } = await import("@/lib/slug/placeSlugService");
    await assignSlugOnPublish(resolvedPlaceId).catch((e) =>
      console.error("[moderation] assignSlugOnPublish failed:", e),
    );
  }

  const { ensurePublishedActivityHasSlug } = await import("@/lib/slug/publishSlugGuards");
  if (!activity.slug) {
    await ensurePublishedActivityHasSlug(activityId);
  }
  timer.mark("response");

  // Single deterministic, awaited final reindex per touched entity — the
  // caller only gets a result after the search document(s) reflect the
  // final published state.
  await searchIndexer.upsertActivityStrict(activityId);
  if (placeCreated && resolvedPlaceId) {
    await searchIndexer.upsertPlaceStrict(resolvedPlaceId);
  }
  timer.log({ status: "PUBLISHED", placeCreated: placeCreated ? 1 : 0, flow: "admin-approve" });

  try {
    const { notifyActivityApproved } = await import("./notification.service");
    if (activity.businessId) {
      notifyActivityApproved(activityId, activity.title, activity.businessId).catch((e) =>
        console.error("[moderation] notifyActivityApproved failed:", e),
      );
    }
  } catch (e) {
    console.error("[moderation] notifyActivityApproved import failed:", e);
  }
}

export async function needsRevisionActivity(
  activityId: string,
  reviewedByUserId: string,
  message: string
): Promise<void> {
  if (!message?.trim()) throw new Error("Message is required for NEEDS_REVISION status");

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { status: true, title: true, businessId: true },
  });

  if (!activity) throw new Error("Activity not found");
  if (activity.status !== "PENDING" && activity.status !== "PENDING_UPDATE") {
    throw new Error(`Cannot request changes from status: ${activity.status}`);
  }

  await prisma.$transaction([
    prisma.activity.update({ where: { id: activityId }, data: { status: "NEEDS_REVISION" } }),
    prisma.moderationLog.create({
      data: { entityType: "ACTIVITY", entityId: activityId, action: "NEEDS_REVISION", message, reviewedByUserId },
    }),
  ]);

  const { notifyActivityNeedsChanges } = await import("./notification.service");
  if (activity.businessId) {
    notifyActivityNeedsChanges(activityId, activity.title, activity.businessId, message).catch((e) =>
      console.error("[moderation] notifyActivityNeedsChanges failed:", e),
    );
  }
}

export async function rejectActivity(
  activityId: string,
  reviewedByUserId: string,
  message: string
): Promise<void> {
  if (!message?.trim()) throw new Error("Message is required for REJECTED status");

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { status: true, title: true, businessId: true },
  });

  if (!activity) throw new Error("Activity not found");
  if (activity.status !== "PENDING" && activity.status !== "PENDING_UPDATE") {
    throw new Error(`Cannot reject from status: ${activity.status}`);
  }

  await prisma.$transaction([
    prisma.activity.update({ where: { id: activityId }, data: { status: "REJECTED" } }),
    prisma.moderationLog.create({
      data: { entityType: "ACTIVITY", entityId: activityId, action: "REJECT", message, reviewedByUserId },
    }),
  ]);

  const { notifyActivityRejected } = await import("./notification.service");
  if (activity.businessId) {
    notifyActivityRejected(activityId, activity.title, activity.businessId, message).catch((e) =>
      console.error("[moderation] notifyActivityRejected failed:", e),
    );
  }
}

// ── OFFER ─────────────────────────────────────────────────────────────────────

/**
 * Who is submitting an Offer for moderation. `OWNER` requires the caller to
 * own the linked Place's Business — checked here, not left to the API route,
 * since this function is also meant to be called directly (migration/admin
 * bulk publication). `PRIVILEGED_MIGRATION` bypasses the ownership check
 * explicitly — never implicitly (there is no way to skip the check other
 * than passing this literal actor type).
 */
export type SubmitOfferForModerationActor =
  | { type: "OWNER"; userId: string }
  | { type: "PRIVILEGED_MIGRATION" };

export interface SubmitOfferForModerationResult {
  status: "PENDING";
  alreadyPending: boolean;
}

/**
 * DRAFT -> PENDING only. Idempotent when already PENDING (returns
 * `alreadyPending: true`, no write). Never touches Place, Business, city,
 * title, slug, content, CTA, or media — status is the only field this
 * writes. Throws (never silently no-ops) for PUBLISHED, REJECTED, or an
 * archived Offer — none of those may be resubmitted by this function.
 */
export async function submitOfferForModeration(
  offerId: string,
  actor: SubmitOfferForModerationActor
): Promise<SubmitOfferForModerationResult> {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: {
      status: true,
      archivedAt: true,
      placeId: true,
      place: { select: { ownerBusiness: { select: { ownerUserId: true } } } },
    },
  });
  if (!offer) throw new Error("Offer not found");

  if (actor.type === "OWNER") {
    const ownerUserId = offer.place?.ownerBusiness?.ownerUserId;
    if (!ownerUserId || ownerUserId !== actor.userId) {
      throw new Error("Not authorized to submit this Offer for moderation");
    }
  }

  if (offer.archivedAt) {
    throw new Error("Cannot submit an archived Offer for moderation");
  }

  if (offer.status === "PENDING") {
    return { status: "PENDING", alreadyPending: true };
  }
  if (offer.status !== "DRAFT") {
    throw new Error(`Cannot submit for moderation from status: ${offer.status}`);
  }
  if (!offer.placeId) {
    throw new Error("Cannot submit an Offer for moderation without a Place");
  }

  await prisma.offer.update({ where: { id: offerId }, data: { status: "PENDING" } });
  return { status: "PENDING", alreadyPending: false };
}

/**
 * Approve an Offer. Resolves owner via place relation.
 */
export async function approveOffer(
  offerId: string,
  reviewedByUserId: string,
): Promise<void> {
  const timer = createPublishTimer("publish:offer");
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { status: true, title: true, slug: true, placeId: true, place: { select: { ownerBusinessId: true } } },
  });

  if (!offer) throw new Error("Offer not found");
  if (offer.status !== "PENDING") throw new Error(`Cannot approve from status: ${offer.status}`);
  if (!offer.placeId) throw new Error("Cannot approve/publish an Offer without a Place");

  // EVENT_SEARCH_INDEX_PUBLICATION_RACE fix: this status update and the
  // slug/canonical sync below are two sequential writes to the same row.
  // Using prismaBase (no search-indexing extension) here means the status
  // update never independently dispatches a fire-and-forget reindex reading
  // a stale (published-but-no-slug) snapshot. The slug/canonical sync is
  // now always awaited (previously fire-and-forget via
  // runAfterPublishResponse when the Offer already had a slug — the caller
  // could get a "success" result before canonical sync even ran), and the
  // explicit final upsertOffer() call below is the single, deterministic,
  // awaited index of the final published state.
  await prismaBase.offer.update({
    where: { id: offerId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  timer.mark("status");

  const { ensurePublishedOfferHasSlug } = await import("@/lib/slug/publishSlugGuards");
  await ensurePublishedOfferHasSlug(offerId);
  timer.mark("response");

  await searchIndexer.upsertOfferStrict(offerId);
  timer.log({ status: "PUBLISHED", flow: "admin-approve" });

  try {
    const { notifyOfferApproved } = await import("./notification.service");
    const ownerId = offer.place?.ownerBusinessId;
    if (ownerId) {
      notifyOfferApproved(offerId, offer.title, ownerId).catch((e) =>
        console.error("[moderation] notifyOfferApproved failed:", e),
      );
    }
  } catch (e) {
    console.error("[moderation] notifyOfferApproved import failed:", e);
  }
}

export async function needsRevisionOffer(
  offerId: string,
  reviewedByUserId: string,
  message: string,
): Promise<void> {
  if (!message?.trim()) throw new Error("Message is required for NEEDS_REVISION status");

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { status: true, title: true, place: { select: { ownerBusinessId: true } } },
  });

  if (!offer) throw new Error("Offer not found");
  if (offer.status !== "PENDING") throw new Error(`Cannot request changes from status: ${offer.status}`);

  await prisma.offer.update({
    where: { id: offerId },
    data: { status: "DRAFT" }, // Offer has no NEEDS_REVISION status — revert to DRAFT
  });

  const { notifyOfferNeedsChanges } = await import("./notification.service");
  const ownerId = offer.place?.ownerBusinessId;
  if (ownerId) {
    notifyOfferNeedsChanges(offerId, offer.title, ownerId, message).catch((e) =>
      console.error("[moderation] notifyOfferNeedsChanges failed:", e),
    );
  }
}

export async function rejectOffer(
  offerId: string,
  reviewedByUserId: string,
  message: string,
): Promise<void> {
  if (!message?.trim()) throw new Error("Message is required for REJECTED status");

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { status: true, title: true, place: { select: { ownerBusinessId: true } } },
  });

  if (!offer) throw new Error("Offer not found");
  if (offer.status !== "PENDING") throw new Error(`Cannot reject from status: ${offer.status}`);

  await prisma.offer.update({
    where: { id: offerId },
    data: { status: "REJECTED", rejectionReason: message },
  });

  const { notifyOfferRejected } = await import("./notification.service");
  const ownerId = offer.place?.ownerBusinessId;
  if (ownerId) {
    notifyOfferRejected(offerId, offer.title, ownerId, message).catch((e) =>
      console.error("[moderation] notifyOfferRejected failed:", e),
    );
  }
}
