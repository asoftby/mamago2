/**
 * Offer archive / restore service.
 *
 * Archive state is derived from archivedAt / archivedByUserId / archiveReason only.
 * OfferStatus is preserved across archive / restore.
 */

import type { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";

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

  if (offer.status === "DRAFT") {
    throw new OfferArchiveError({
      code: "OFFER_ARCHIVE_NOT_ALLOWED",
      message: "Черновик предложения нельзя архивировать. Для него доступно только удаление.",
      statusCode: 409,
    });
  }

  if (offer.archivedAt) {
    throw new OfferArchiveError({
      code: "OFFER_ALREADY_ARCHIVED",
      message: "Предложение уже в архиве",
      statusCode: 409,
    });
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

  if (!offer.archivedAt) {
    throw new OfferArchiveError({
      code: "OFFER_NOT_ARCHIVED",
      message: "Предложение не находится в архиве",
      statusCode: 409,
    });
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
