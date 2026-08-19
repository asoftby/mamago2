import type { NormalizedOfferCandidate } from "../../adapters/wordpress-db/normalizeOffer";
import type { MigrationCommitContextConfig } from "../context/resolveCommitContextConfig";
import type { MediaPolicyName } from "../../runtime/MigrationProfile";
import { collapseOfferPlaceRelations } from "./collapseOfferPlaceRelations";
import type { OfferCommitContext } from "./types";
import type { PrismaClient } from "@prisma/client";

export interface HydrateOfferContextsPrismaClient {
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findMany">;
  place: Pick<PrismaClient["place"], "findUnique">;
}

export async function hydrateOfferContextsFromPlaceLineage(input: {
  records: readonly { sourceRecordKey: string; candidate: NormalizedOfferCandidate }[];
  contextConfig: MigrationCommitContextConfig;
  prisma: HydrateOfferContextsPrismaClient;
  mediaPolicyName: MediaPolicyName;
}): Promise<MigrationCommitContextConfig> {
  const overrides = { ...(input.contextConfig.overridesBySourceRecordKey ?? {}) };
  for (const record of input.records) {
    const collapse = collapseOfferPlaceRelations({
      offerPostId: record.candidate.sourcePostId,
      relations: record.candidate.placeRelation.relations,
    });
    if (collapse.status === "MISSING") {
      // No Place relation at all in the source (never had one) — a
      // deliberate placeless DRAFT import, not a guess: no owner/city is
      // fabricated. buildOfferCreateDraft recognizes this exact all-null
      // shape and lets it through only for a "MISSING" collapse.
      const offerContext: OfferCommitContext = {
        placeId: null,
        legacyPlaceId: null,
        ownerUserId: null,
        businessId: null,
        cityId: null,
        mediaPolicy: input.mediaPolicyName,
      };
      overrides[record.sourceRecordKey] = {
        ...(overrides[record.sourceRecordKey] ?? {}),
        offer: { ...(overrides[record.sourceRecordKey]?.offer ?? {}), ...offerContext },
      };
      continue;
    }
    if (collapse.status !== "RESOLVED") continue;
    const placeKey = `wordpress-db:places:${collapse.effectiveLegacyPlaceId}`;
    const lineages = await input.prisma.migrationLineage.findMany({
      where: { sourceRecordKey: placeKey, targetType: "PLACE", isActive: true },
    });
    if (lineages.length !== 1 || !lineages[0]?.targetId) continue;
    const place = await input.prisma.place.findUnique({
      where: { id: lineages[0].targetId },
      select: { id: true, createdByUserId: true, ownerBusinessId: true, cityId: true },
    });
    if (!place?.cityId || !place.createdByUserId) continue;
    const offerContext: OfferCommitContext = {
      placeId: place.id,
      legacyPlaceId: collapse.effectiveLegacyPlaceId,
      ownerUserId: place.createdByUserId,
      businessId: place.ownerBusinessId,
      cityId: place.cityId,
      mediaPolicy: input.mediaPolicyName,
    };
    overrides[record.sourceRecordKey] = {
      ...(overrides[record.sourceRecordKey] ?? {}),
      offer: { ...(overrides[record.sourceRecordKey]?.offer ?? {}), ...offerContext },
    };
  }
  return { ...input.contextConfig, overridesBySourceRecordKey: overrides };
}
