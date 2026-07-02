/**
 * Direct thread command layer.
 *
 * Architectural invariants enforced here (see Direct Phase 0/0.5 audit):
 *  - A thread can only be created by a customer (createDirectThread always
 *    takes the authenticated User as customerUserId — there is no
 *    "create on behalf of business" entrypoint, which is how rule
 *    "Business никогда не может создать Direct первым" is enforced).
 *  - A thread always resolves to exactly one owning Business via the
 *    publication (resolveBusinessFromPublication) — if the publication has
 *    no owning Business, thread creation fails (rule 5).
 *  - Polymorphic publication link mirrors BookingRequest: publicationType +
 *    offerId/activityId/placeId nullable FKs instead of a single polymorphic
 *    publicationId — keeps strict FKs and matches the existing project
 *    standard rather than introducing a new association pattern.
 */

import prisma from "@/lib/prisma";
import {
  DirectActorType,
  DirectThreadStatus,
  PublicationType,
} from "@prisma/client";
import { resolveCanonicalActivityBusinessId } from "@/lib/auth/activityAccess";
import {
  DIRECT_AUDIT_ENTITY,
  DirectAuditAction,
  writeDirectAudit,
} from "./directAudit";
import { recordDirectRiskSignal } from "./directRiskSignal.service";

export class DirectThreadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectThreadError";
  }
}

export interface PublicationRef {
  publicationType: PublicationType;
  offerId?: string | null;
  activityId?: string | null;
  placeId?: string | null;
}

export interface ResolvedPublication {
  type: PublicationType;
  publication: { id: string; title: string | null };
  /** name = brand fallback for placeless publications (e.g. online-only EVENT). */
  business: { id: string; ownerUserId: string; name: string };
  /** Convenience accessor — the User who owns the resolved business. */
  owner: { userId: string };
}

/**
 * Single resolver for "what is this Direct thread actually about" — used
 * everywhere a thread/message/notification needs the publication, its
 * owning business, or the business owner, instead of each call site
 * re-deriving the same Place/Offer/Activity → Business chain.
 *
 * Reuses the same ownership chain as the rest of the app
 * (Place.ownerBusinessId for PLACE, Offer → Place.ownerBusinessId for OFFER,
 * resolveCanonicalActivityBusinessId for EVENT/Activity). Throws if the
 * publication is not owned by any Business — Direct must never be created
 * in that state (rule 5).
 */
export async function resolvePublication(
  ref: PublicationRef,
): Promise<ResolvedPublication> {
  let publication: { id: string; title: string | null };
  let businessId: string;

  switch (ref.publicationType) {
    case PublicationType.PLACE: {
      if (!ref.placeId) {
        throw new DirectThreadError("placeId is required for PLACE publications");
      }
      const place = await prisma.place.findUnique({
        where: { id: ref.placeId },
        select: { id: true, title: true, ownerBusinessId: true },
      });
      if (!place) {
        throw new DirectThreadError("Publication not found");
      }
      if (!place.ownerBusinessId) {
        throw new DirectThreadError(
          "Publication is not owned by a Business — Direct cannot be created",
        );
      }
      publication = { id: place.id, title: place.title };
      businessId = place.ownerBusinessId;
      break;
    }

    case PublicationType.OFFER: {
      if (!ref.offerId) {
        throw new DirectThreadError("offerId is required for OFFER publications");
      }
      const offer = await prisma.offer.findUnique({
        where: { id: ref.offerId },
        select: { id: true, title: true, place: { select: { ownerBusinessId: true } } },
      });
      if (!offer) {
        throw new DirectThreadError("Publication not found");
      }
      if (!offer.place?.ownerBusinessId) {
        throw new DirectThreadError(
          "Publication is not owned by a Business — Direct cannot be created",
        );
      }
      publication = { id: offer.id, title: offer.title };
      businessId = offer.place.ownerBusinessId;
      break;
    }

    case PublicationType.EVENT: {
      if (!ref.activityId) {
        throw new DirectThreadError("activityId is required for EVENT publications");
      }
      const activity = await prisma.activity.findUnique({
        where: { id: ref.activityId },
        select: {
          id: true,
          title: true,
          businessId: true,
          placeId: true,
          place: { select: { ownerBusinessId: true } },
        },
      });
      if (!activity) {
        throw new DirectThreadError("Publication not found");
      }
      const resolvedBusinessId = resolveCanonicalActivityBusinessId(activity, activity.place);
      if (!resolvedBusinessId) {
        throw new DirectThreadError(
          "Publication is not owned by a Business — Direct cannot be created",
        );
      }
      publication = { id: activity.id, title: activity.title };
      businessId = resolvedBusinessId;
      break;
    }

    default: {
      const unreachable: never = ref.publicationType;
      throw new DirectThreadError(`Unsupported publicationType: ${unreachable}`);
    }
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerUserId: true, name: true },
  });
  if (!business) {
    throw new DirectThreadError("Owning business not found");
  }

  return {
    type: ref.publicationType,
    publication,
    business: { id: business.id, ownerUserId: business.ownerUserId, name: business.name },
    owner: { userId: business.ownerUserId },
  };
}

/** Convenience accessor for call sites that only need the businessId. */
export async function resolveBusinessFromPublication(
  ref: PublicationRef,
): Promise<string> {
  const resolved = await resolvePublication(ref);
  return resolved.business.id;
}

/**
 * Non-throwing variant for public-page CTA gating: returns null instead of
 * throwing when the publication has no owning Business (rule 5) or isn't
 * found, so a page Server Component can do
 * `const direct = await tryResolvePublicationForCta(ref); {direct && <Cta/>}`
 * without a try/catch.
 */
export async function tryResolvePublicationForCta(
  ref: PublicationRef,
): Promise<ResolvedPublication | null> {
  try {
    return await resolvePublication(ref);
  } catch (error) {
    if (error instanceof DirectThreadError) return null;
    throw error;
  }
}

export interface CreateDirectThreadInput extends PublicationRef {
  customerUserId: string;
  /** Optional link to the BookingRequest this Direct thread grew out of. */
  bookingRequestId?: string | null;
  initialMessage: string;
}

/**
 * Creates a thread + its first message in one transaction. The first
 * message is always CUSTOMER-authored, matching "Direct всегда инициирует
 * пользователь".
 */
export async function createDirectThread(input: CreateDirectThreadInput) {
  const body = input.initialMessage.trim();
  if (!body) {
    throw new DirectThreadError("initialMessage cannot be empty");
  }

  const resolved = await resolvePublication(input);

  // A business owner cannot use their own customer account to open a thread
  // on their own publication — that would collapse the customer/business
  // distinction the whole module is built on.
  if (resolved.owner.userId === input.customerUserId) {
    throw new DirectThreadError(
      "Business owner cannot open a Direct thread on their own publication",
    );
  }

  const now = new Date();
  const thread = await prisma.directThread.create({
    data: {
      publicationType: input.publicationType,
      offerId: input.offerId ?? null,
      activityId: input.activityId ?? null,
      placeId: input.placeId ?? null,
      businessId: resolved.business.id,
      customerUserId: input.customerUserId,
      bookingRequestId: input.bookingRequestId ?? null,
      status: DirectThreadStatus.OPEN,
      lastMessageAt: now,
      lastMessageBy: DirectActorType.CUSTOMER,
      messages: {
        create: {
          senderType: DirectActorType.CUSTOMER,
          senderUserId: input.customerUserId,
          body,
          createdAt: now,
        },
      },
    },
    include: { messages: true, business: { select: { ownerUserId: true } } },
  });

  await writeDirectAudit({
    action: DirectAuditAction.THREAD_CREATED,
    entityType: DIRECT_AUDIT_ENTITY.THREAD,
    entityId: thread.id,
    actorId: input.customerUserId,
    actorRole: "USER",
    after: {
      threadNumber: thread.threadNumber,
      businessId: resolved.business.id,
      publicationType: input.publicationType,
      offerId: input.offerId ?? null,
      activityId: input.activityId ?? null,
      placeId: input.placeId ?? null,
      bookingRequestId: input.bookingRequestId ?? null,
    },
  });

  return thread;
}

/**
 * Marks the other side's messages as read for the given reader.
 * readerType=CUSTOMER clears BUSINESS/SYSTEM/ADMIN messages; readerType=BUSINESS
 * clears CUSTOMER/SYSTEM/ADMIN messages. ADMIN messages (a live mamaGo staff
 * intervention) count as unread for both sides, same as SYSTEM.
 */
export async function markThreadRead(params: {
  threadId: string;
  readerType: typeof DirectActorType.CUSTOMER | typeof DirectActorType.BUSINESS;
  readAt?: Date;
}) {
  const readAt = params.readAt ?? new Date();
  const senderTypesToMark: DirectActorType[] =
    params.readerType === DirectActorType.CUSTOMER
      ? [DirectActorType.BUSINESS, DirectActorType.SYSTEM, DirectActorType.ADMIN]
      : [DirectActorType.CUSTOMER, DirectActorType.SYSTEM, DirectActorType.ADMIN];

  return prisma.directMessage.updateMany({
    where: {
      threadId: params.threadId,
      senderType: { in: senderTypesToMark },
      readAt: null,
    },
    data: { readAt },
  });
}

export async function blockThread(params: {
  threadId: string;
  blockedByUserId: string;
  actorRole: string;
  reason?: string | null;
}) {
  const updated = await prisma.directThread.update({
    where: { id: params.threadId },
    data: {
      status: DirectThreadStatus.BLOCKED,
      blockedAt: new Date(),
      blockedByUserId: params.blockedByUserId,
    },
  });

  await writeDirectAudit({
    action: DirectAuditAction.THREAD_BLOCKED,
    entityType: DIRECT_AUDIT_ENTITY.THREAD,
    entityId: updated.id,
    actorId: params.blockedByUserId,
    actorRole: params.actorRole,
    reason: params.reason ?? null,
  });

  await recordDirectRiskSignal({
    threadId: updated.id,
    businessId: updated.businessId,
    customerUserId: updated.customerUserId,
    signalType: "THREAD_BLOCKED",
    auditAction: DirectAuditAction.RISK_SIGNAL_CREATED,
    metadata: { reason: params.reason ?? null },
  });

  return updated;
}

export async function unblockThread(params: {
  threadId: string;
  unblockedByUserId: string;
  actorRole: string;
}) {
  const updated = await prisma.directThread.update({
    where: { id: params.threadId },
    data: {
      status: DirectThreadStatus.OPEN,
      blockedAt: null,
      blockedByUserId: null,
    },
  });

  await writeDirectAudit({
    action: DirectAuditAction.THREAD_UNBLOCKED,
    entityType: DIRECT_AUDIT_ENTITY.THREAD,
    entityId: updated.id,
    actorId: params.unblockedByUserId,
    actorRole: params.actorRole,
  });

  return updated;
}

/**
 * Marks the thread CLOSED + stamps completedAt. completedAt is the gate a
 * later phase uses to decide when "rate this conversation" becomes
 * available — without it, that phase would have to reconstruct "when did
 * this end" from status-change history instead of reading one column.
 */
export async function completeThread(params: {
  threadId: string;
  completedByUserId: string;
  actorRole: string;
}) {
  const updated = await prisma.directThread.update({
    where: { id: params.threadId },
    data: {
      status: DirectThreadStatus.CLOSED,
      completedAt: new Date(),
    },
  });

  await writeDirectAudit({
    action: DirectAuditAction.THREAD_COMPLETED,
    entityType: DIRECT_AUDIT_ENTITY.THREAD,
    entityId: updated.id,
    actorId: params.completedByUserId,
    actorRole: params.actorRole,
  });

  return updated;
}
