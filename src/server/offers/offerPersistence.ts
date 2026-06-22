import type { Prisma, OfferProductType } from "@prisma/client";
import {
  inferRequestedPlacements,
  normalizePlacementKeys,
} from "@/lib/offers/offerPersistenceCompatibility";

type PrismaLike = Pick<Prisma.TransactionClient, "offerPlacement">;

export async function syncOfferPersistenceLayer(params: {
  db: PrismaLike;
  offerId: string;
  actorUserId?: string | null;
  productType: OfferProductType;
  requestedPlacementsStrategy?: "infer_if_missing" | "preserve_if_missing";
  requestedPlacements?: readonly string[] | null;
  requestedPlacementsProvided?: boolean;
}) {
  const requestedPlacementsStrategy =
    params.requestedPlacementsStrategy ?? "infer_if_missing";
  const requestedPlacementsProvided =
    params.requestedPlacementsProvided ?? params.requestedPlacements !== undefined;

  const placementKeys = requestedPlacementsProvided
    ? normalizePlacementKeys(params.requestedPlacements ?? [])
    : requestedPlacementsStrategy === "infer_if_missing"
      ? inferRequestedPlacements({
          productType: params.productType,
          requestedPlacements: params.requestedPlacements,
        })
      : null;

  if (placementKeys !== null) {
    const existingPlacements = await params.db.offerPlacement.findMany({
      where: { offerId: params.offerId },
      select: { id: true, key: true, status: true },
    });
    const existingByKey = new Map(
      existingPlacements.map((placement) => [placement.key, placement]),
    );
    const requestedSet = new Set(placementKeys);

    for (const key of placementKeys) {
      const existing = existingByKey.get(key);

      if (!existing) {
        await params.db.offerPlacement.create({
          data: {
            offerId: params.offerId,
            key,
            status: "REQUESTED",
            requestedById: params.actorUserId ?? null,
          },
        });
        continue;
      }

      if (existing.status === "REJECTED") {
        await params.db.offerPlacement.update({
          where: {
            offerId_key: {
              offerId: params.offerId,
              key,
            },
          },
          data: {
            status: "REQUESTED",
            requestedAt: new Date(),
            requestedById: params.actorUserId ?? null,
            reviewedAt: null,
            reviewedById: null,
            rejectionReason: null,
          },
        });
      }
    }

    const removableRequestedKeys = existingPlacements
      .filter(
        (placement) =>
          placement.status === "REQUESTED" && !requestedSet.has(placement.key),
      )
      .map((placement) => placement.key);

    if (removableRequestedKeys.length > 0) {
      await params.db.offerPlacement.deleteMany({
        where: {
          offerId: params.offerId,
          status: "REQUESTED",
          key: { in: removableRequestedKeys },
        },
      });
    }
  }
}
