import type { Prisma, OfferProductType } from "@prisma/client";
import {
  inferRequestedPlacements,
  normalizePlacementKeys,
  supportsBirthdayDetails,
  type OfferBirthdayDetailsInput,
} from "@/lib/offers/offerPersistenceCompatibility";

type PrismaLike = Pick<
  Prisma.TransactionClient,
  "offerPlacement" | "offerBirthdayDetails"
>;

function hasBirthdayDetailsContent(input: OfferBirthdayDetailsInput): input is NonNullable<OfferBirthdayDetailsInput> {
  if (!input) return false;
  return Boolean(
    input.role ||
      input.locationType ||
      input.durationMinutes != null ||
      input.minChildren != null ||
      input.maxChildren != null ||
      input.priceFrom != null ||
      input.included?.trim() ||
      input.program?.trim() ||
      input.note?.trim(),
  );
}

export async function syncOfferPersistenceLayer(params: {
  db: PrismaLike;
  offerId: string;
  actorUserId?: string | null;
  productType: OfferProductType;
  requestedPlacementsStrategy?: "infer_if_missing" | "preserve_if_missing";
  requestedPlacements?: readonly string[] | null;
  requestedPlacementsProvided?: boolean;
  birthdayDetails?: OfferBirthdayDetailsInput;
  birthdayDetailsProvided?: boolean;
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

  const birthdayDetailsProvided =
    params.birthdayDetailsProvided ?? params.birthdayDetails !== undefined;
  if (!birthdayDetailsProvided) {
    return;
  }

  const birthdayDetails = params.birthdayDetails ?? null;
  if (birthdayDetails === null) {
    await params.db.offerBirthdayDetails.deleteMany({
      where: { offerId: params.offerId },
    });
    return;
  }

  if (!hasBirthdayDetailsContent(birthdayDetails) || !birthdayDetails.role) {
    return;
  }

  const birthdayEnabled = supportsBirthdayDetails(
    params.productType,
    placementKeys ?? undefined,
  );
  if (!birthdayEnabled) {
    return;
  }

  await params.db.offerBirthdayDetails.upsert({
    where: { offerId: params.offerId },
    update: {
      role: birthdayDetails.role,
      locationType: birthdayDetails.locationType ?? null,
      durationMinutes: birthdayDetails.durationMinutes ?? null,
      minChildren: birthdayDetails.minChildren ?? null,
      maxChildren: birthdayDetails.maxChildren ?? null,
      priceFrom: birthdayDetails.priceFrom ?? null,
      included: birthdayDetails.included?.trim() || null,
      program: birthdayDetails.program?.trim() || null,
      note: birthdayDetails.note?.trim() || null,
    },
    create: {
      offerId: params.offerId,
      role: birthdayDetails.role,
      locationType: birthdayDetails.locationType ?? null,
      durationMinutes: birthdayDetails.durationMinutes ?? null,
      minChildren: birthdayDetails.minChildren ?? null,
      maxChildren: birthdayDetails.maxChildren ?? null,
      priceFrom: birthdayDetails.priceFrom ?? null,
      included: birthdayDetails.included?.trim() || null,
      program: birthdayDetails.program?.trim() || null,
      note: birthdayDetails.note?.trim() || null,
    },
  });
}
