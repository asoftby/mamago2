/**
 * Place archive / restore service.
 *
 * Archive state is derived from archivedAt / archivedByUserId only.
 * ContentStatus is not changed here.
 */

import { ContentStatus, type Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";
import { detachImportedRecordsForCatalogEntity } from "@/server/modules/import/services/import-link-reconciliation.service";
import {
  assertContentLifecycleOperationAllowed,
  ContentLifecycleOperationError,
  lifecycleErrorResponsePayload,
} from "@/server/services/contentLifecycleOperation.service";

type PlaceArchiveActor = {
  id: string;
  role: Role;
};

type PlaceArchivePreflight = {
  liveOffersCount: number;
  liveActivitiesCount: number;
};

const LIVE_ACTIVITY_STATUSES: ContentStatus[] = [
  ContentStatus.PUBLISHED,
  ContentStatus.PENDING_UPDATE,
];

function isPrivilegedActor(role: Role) {
  return role === "ADMIN" || role === "MODERATOR";
}

function buildBlockedByChildrenMessage(preflight: PlaceArchivePreflight) {
  const parts: string[] = [];

  if (preflight.liveOffersCount > 0) {
    parts.push(
      `${preflight.liveOffersCount} ${preflight.liveOffersCount === 1 ? "опубликованное предложение" : "опубликованных предложения"}`,
    );
  }

  if (preflight.liveActivitiesCount > 0) {
    parts.push(
      `${preflight.liveActivitiesCount} ${preflight.liveActivitiesCount === 1 ? "активное событие" : "активных события"}`,
    );
  }

  return `Нельзя архивировать место, пока с ним связаны ${parts.join(" и ")}. Сначала снимите их с публикации или перепривяжите к другому месту.`;
}

export class PlaceArchiveError extends Error {
  statusCode: number;
  code: string;

  constructor(params: { message: string; statusCode: number; code: string }) {
    super(params.message);
    this.name = "PlaceArchiveError";
    this.statusCode = params.statusCode;
    this.code = params.code;
  }
}

function rethrowLifecycleAsPlaceArchiveError(error: unknown): never {
  if (error instanceof ContentLifecycleOperationError) {
    const payload = lifecycleErrorResponsePayload(error);
    throw new PlaceArchiveError({
      code: payload.code,
      message: payload.message,
      statusCode: error.statusCode,
    });
  }
  throw error;
}

async function loadPlaceForArchive(placeId: string) {
  return prisma.place.findUnique({
    where: { id: placeId },
    select: {
      id: true,
      title: true,
      status: true,
      archivedAt: true,
      ownerBusinessId: true,
      createdByUserId: true,
    },
  });
}

async function assertPlaceArchiveAccess(
  placeId: string,
  actor: PlaceArchiveActor,
) {
  const place = await loadPlaceForArchive(placeId);

  if (!place) {
    throw new PlaceArchiveError({
      code: "PLACE_NOT_FOUND",
      message: "Место не найдено",
      statusCode: 404,
    });
  }

  if (!isPrivilegedActor(actor.role)) {
    const canManage = await canManagePlaceAsync(actor, place);
    if (!canManage) {
      throw new PlaceArchiveError({
        code: "PLACE_ACCESS_DENIED",
        message: "У вас нет доступа к этому месту",
        statusCode: 403,
      });
    }
  }

  return place;
}

async function getArchivePreflight(placeId: string): Promise<PlaceArchivePreflight> {
  const [liveOffersCount, liveActivitiesCount] = await Promise.all([
    prisma.offer.count({
      where: {
        placeId,
        status: "PUBLISHED",
      },
    }),
    prisma.activity.count({
      where: {
        placeId,
        status: {
          in: LIVE_ACTIVITY_STATUSES,
        },
      },
    }),
  ]);

  return {
    liveOffersCount,
    liveActivitiesCount,
  };
}

async function assertArchivePreflight(placeId: string) {
  const preflight = await getArchivePreflight(placeId);

  if (preflight.liveOffersCount > 0 || preflight.liveActivitiesCount > 0) {
    throw new PlaceArchiveError({
      code: "PLACE_ARCHIVE_BLOCKED_BY_LIVE_CHILDREN",
      message: buildBlockedByChildrenMessage(preflight),
      statusCode: 409,
    });
  }

  return preflight;
}

export async function archivePlace(placeId: string, actor: PlaceArchiveActor) {
  const place = await assertPlaceArchiveAccess(placeId, actor);

  try {
    await assertContentLifecycleOperationAllowed({
      contentType: "PLACE",
      contentId: placeId,
      operation: "archiveContent",
      status: place.status,
      archivedAt: place.archivedAt,
      prisma,
    });
  } catch (error) {
    rethrowLifecycleAsPlaceArchiveError(error);
  }

  await assertArchivePreflight(placeId);

  const updated = await prisma.place.update({
    where: { id: placeId },
    data: {
      archivedAt: new Date(),
      archivedByUserId: actor.id,
    },
  });

  await detachImportedRecordsForCatalogEntity(
    {
      entityType: "PLACE",
      entityId: placeId,
      reason: "Связанный Place заархивирован и больше не считается активной сущностью каталога.",
    },
    prisma,
  );

  return updated;
}

export async function unarchivePlace(placeId: string, actor: PlaceArchiveActor) {
  const place = await assertPlaceArchiveAccess(placeId, actor);

  try {
    await assertContentLifecycleOperationAllowed({
      contentType: "PLACE",
      contentId: placeId,
      operation: "restoreArchived",
      status: place.status,
      archivedAt: place.archivedAt,
      prisma,
    });
  } catch (error) {
    rethrowLifecycleAsPlaceArchiveError(error);
  }

  return prisma.place.update({
    where: { id: placeId },
    data: {
      archivedAt: null,
      archivedByUserId: null,
    },
  });
}

export async function getPlaceArchivePreflight(placeId: string) {
  await loadPlaceForArchive(placeId);
  return getArchivePreflight(placeId);
}
