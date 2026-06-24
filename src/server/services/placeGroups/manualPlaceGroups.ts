import type { Prisma } from "@prisma/client";

export class PlaceGroupValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PlaceGroupValidationError";
    this.status = status;
  }
}

type Tx = Prisma.TransactionClient;

type MinimalPlace = {
  id: string;
  createdByUserId: string;
  ownerBusinessId: string | null;
  placeGroupId: string | null;
};

type SyncPlaceGroupInput = {
  tx: Tx;
  place: MinimalPlace;
  relatedPlaceIds: string[];
  sameBusinessOnly?: boolean;
};

function normalizeRelatedPlaceIds(placeId: string, relatedPlaceIds: string[]) {
  const normalized = Array.from(
    new Set(
      relatedPlaceIds
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

  if (normalized.includes(placeId)) {
    throw new PlaceGroupValidationError("A place cannot be linked to itself");
  }

  return normalized;
}

async function cleanupGroupIfSmall(tx: Tx, groupId: string | null) {
  if (!groupId) return;

  const members = await tx.place.findMany({
    where: { placeGroupId: groupId },
    select: { id: true },
  });

  if (members.length === 0) {
    await tx.placeGroup.delete({ where: { id: groupId } }).catch(() => null);
    return;
  }

  if (members.length === 1) {
    await tx.place.update({
      where: { id: members[0].id },
      data: { placeGroupId: null },
    });
    await tx.placeGroup.delete({ where: { id: groupId } }).catch(() => null);
  }
}

export async function syncManualPlaceGroup({
  tx,
  place,
  relatedPlaceIds,
  sameBusinessOnly = false,
}: SyncPlaceGroupInput) {
  const normalizedIds = normalizeRelatedPlaceIds(place.id, relatedPlaceIds);

  const relatedPlaces = normalizedIds.length
    ? await tx.place.findMany({
        where: {
          id: { in: normalizedIds },
          ...(sameBusinessOnly
            ? { ownerBusinessId: place.ownerBusinessId }
            : undefined),
        },
        select: {
          id: true,
          placeGroupId: true,
        },
      })
    : [];

  if (relatedPlaces.length !== normalizedIds.length) {
    throw new PlaceGroupValidationError(
      sameBusinessOnly
        ? "Some selected places were not found or do not belong to the same business"
        : "Some selected places were not found",
      400,
    );
  }

  const desiredMemberIds = [place.id, ...normalizedIds];
  const sourceGroupIds = new Set<string>();

  if (place.placeGroupId) {
    sourceGroupIds.add(place.placeGroupId);
  }

  for (const relatedPlace of relatedPlaces) {
    if (relatedPlace.placeGroupId) {
      sourceGroupIds.add(relatedPlace.placeGroupId);
    }
  }

  if (normalizedIds.length === 0) {
    if (place.placeGroupId) {
      await tx.place.update({
        where: { id: place.id },
        data: { placeGroupId: null },
      });
    }

    for (const groupId of sourceGroupIds) {
      await cleanupGroupIfSmall(tx, groupId);
    }

    return { placeGroupId: null };
  }

  let targetGroupId =
    place.placeGroupId ??
    relatedPlaces.find((relatedPlace) => relatedPlace.placeGroupId)?.placeGroupId ??
    null;

  if (!targetGroupId) {
    const group = await tx.placeGroup.create({
      data: {
        createdByUserId: place.createdByUserId,
      },
      select: { id: true },
    });
    targetGroupId = group.id;
  }

  await tx.place.updateMany({
    where: {
      placeGroupId: targetGroupId,
      id: { notIn: desiredMemberIds },
    },
    data: {
      placeGroupId: null,
    },
  });

  await tx.place.updateMany({
    where: {
      id: { in: desiredMemberIds },
    },
    data: {
      placeGroupId: targetGroupId,
    },
  });

  for (const groupId of sourceGroupIds) {
    await cleanupGroupIfSmall(tx, groupId);
  }

  return { placeGroupId: targetGroupId };
}
