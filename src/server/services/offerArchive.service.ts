/**
 * Offer archive / restore service.
 *
 * Archive state is derived from archivedAt / archivedByUserId / archiveReason only.
 * OfferStatus is preserved across archive / restore.
 */

import type { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";
import {
  assertContentLifecycleOperationAllowed,
  ContentLifecycleOperationError,
  lifecycleErrorResponsePayload,
} from "@/server/services/contentLifecycleOperation.service";

type OfferArchiveActor = {
  id: string;
  role: Role;
};

type ArchiveOfferParams = {
  offerId: string;
  actor: OfferArchiveActor;
  archiveReason?: string | null;
};

function isPrivilegedActor(role: Role) {
  return role === "ADMIN" || role === "MODERATOR";
}

export class OfferArchiveError extends Error {
  statusCode: number;
  code: string;

  constructor(params: { message: string; statusCode: number; code: string }) {
    super(params.message);
    this.name = "OfferArchiveError";
    this.statusCode = params.statusCode;
    this.code = params.code;
  }
}

function rethrowLifecycleAsOfferArchiveError(error: unknown): never {
  if (error instanceof ContentLifecycleOperationError) {
    const payload = lifecycleErrorResponsePayload(error);
    throw new OfferArchiveError({
      code: payload.code,
      message: payload.message,
      statusCode: error.statusCode,
    });
  }
  throw error;
}

async function loadOfferForArchive(offerId: string) {
  return prisma.offer.findUnique({
    where: { id: offerId },
    select: {
      id: true,
      title: true,
      status: true,
      archivedAt: true,
      archivedByUserId: true,
      archiveReason: true,
      place: {
        select: {
          ownerBusinessId: true,
          createdByUserId: true,
        },
      },
    },
  });
}

async function assertOfferArchiveAccess(
  offerId: string,
  actor: OfferArchiveActor,
) {
  const offer = await loadOfferForArchive(offerId);

  if (!offer) {
    throw new OfferArchiveError({
      code: "OFFER_NOT_FOUND",
      message: "Предложение не найдено",
      statusCode: 404,
    });
  }

  if (!isPrivilegedActor(actor.role)) {
    const canManage = await canManagePlaceAsync(actor, offer.place);
    if (!canManage) {
      throw new OfferArchiveError({
        code: "OFFER_ACCESS_DENIED",
        message: "У вас нет доступа к этому предложению",
        statusCode: 403,
      });
    }
  }

  return offer;
}

export async function archiveOffer({
  offerId,
  actor,
  archiveReason,
}: ArchiveOfferParams) {
  const offer = await assertOfferArchiveAccess(offerId, actor);

  try {
    await assertContentLifecycleOperationAllowed({
      contentType: "OFFER",
      contentId: offerId,
      operation: "archiveContent",
      status: offer.status,
      archivedAt: offer.archivedAt,
      prisma,
    });
  } catch (error) {
    rethrowLifecycleAsOfferArchiveError(error);
  }

  return prisma.offer.update({
    where: { id: offerId },
    data: {
      archivedAt: new Date(),
      archivedByUserId: actor.id,
      archiveReason: archiveReason?.trim() || null,
    },
  });
}

export async function unarchiveOffer(
  offerId: string,
  actor: OfferArchiveActor,
) {
  const offer = await assertOfferArchiveAccess(offerId, actor);

  try {
    await assertContentLifecycleOperationAllowed({
      contentType: "OFFER",
      contentId: offerId,
      operation: "restoreArchived",
      status: offer.status,
      archivedAt: offer.archivedAt,
      prisma,
    });
  } catch (error) {
    rethrowLifecycleAsOfferArchiveError(error);
  }

  return prisma.offer.update({
    where: { id: offerId },
    data: {
      archivedAt: null,
      archivedByUserId: null,
      archiveReason: null,
    },
  });
}
