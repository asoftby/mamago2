import type { MigrationTargetType, PrismaClient } from "@prisma/client";
import { normalizePlace } from "../../adapters/wordpress-db/normalizePlace";
import type { WordPressPlaceBundle } from "../../adapters/wordpress-db/types";
import type { NormalizedPlaceCandidate } from "../../commit/place/types";
import { buildPlaceCreateDraft } from "../../commit/place/buildPlaceCreateDraft";
import { PlaceCommitWriter } from "../../commit/place/PlaceCommitWriter";
import { MigrationLineageWriter } from "../../lineage/MigrationLineageWriter";
import type { LineageOnlyTargetState } from "./lineageOnlyPlanner";
import type { PlacesMigrationCandidate, PlacesMigrationWriteResult, ResolvedPlacesDependencies } from "./placesAdapter";

const PLACE_TARGET_TYPE: MigrationTargetType = "PLACE";
const USER_TARGET_TYPE: MigrationTargetType = "USER";

export interface PlacesProductionWiringPrismaClient {
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findMany">;
  business?: Pick<PrismaClient["business"], "findUnique">;
}

export function createPlacesTargetStateResolver(
  prisma: PlacesProductionWiringPrismaClient,
  sourceId: string,
): (candidate: PlacesMigrationCandidate) => Promise<LineageOnlyTargetState> {
  return async (candidate) => {
    const lineages = await prisma.migrationLineage.findMany({
      where: { sourceId, sourceRecordKey: candidate.sourceRecordKey, targetType: PLACE_TARGET_TYPE, targetRole: "primary", isActive: true },
    });
    if (lineages.length !== 1) {
      return { lineageCount: lineages.length, targetExists: false, lineageDomainHash: lineages[0]?.lastSourceHash ?? null };
    }
    // Place has no dedicated idempotency column (unlike Offer.createRequestId)
    // — an active lineage row with a targetId IS the proof of existence.
    return { lineageCount: 1, targetExists: Boolean(lineages[0].targetId), lineageDomainHash: lineages[0].lastSourceHash };
  };
}

export function createPlacesDependencyResolver(
  prisma: PlacesProductionWiringPrismaClient,
  sourceId: string,
): (candidate: PlacesMigrationCandidate) => Promise<ResolvedPlacesDependencies> {
  return async (candidate) => {
    const ownerLineages = await prisma.migrationLineage.findMany({
      where: { sourceId, sourceRecordKey: candidate.dependencyPlan.ownerUserSourceRecordKey, targetType: USER_TARGET_TYPE, targetRole: "primary", isActive: true },
    });
    if (ownerLineages.length === 0) throw new Error("PLACE_OWNER_DEPENDENCY_NOT_FOUND");
    if (ownerLineages.length > 1) throw new Error("PLACE_OWNER_DEPENDENCY_AMBIGUOUS");
    const ownerUserId = ownerLineages[0].targetId;
    if (!ownerUserId) throw new Error("PLACE_OWNER_DEPENDENCY_NOT_FOUND");
    const business = prisma.business ? await prisma.business.findUnique({ where: { ownerUserId }, select: { id: true } }) : null;
    return { createdByUserId: ownerUserId, ownerBusinessId: business?.id ?? null };
  };
}

export interface RawPlaceSourceRepository {
  loadNormalizedCandidate(sourceRecordKey: string): NormalizedPlaceCandidate;
  /** Only `post.post_author` is needed beyond the normalized candidate — the legacy owner's WP user id. */
  loadLegacyAuthorId(sourceRecordKey: string): number;
  /** The already-computed `wordpress-db-domain-v2` hash embedded in the captured envelope — never recomputed here. */
  loadSourceHash(sourceRecordKey: string): string;
}

/**
 * `post_author` is a standard WordPress field, already used the same way
 * for Offer's `legacyAuthorId` — the legacy owner's WP user id. Resolving
 * it to `wordpress-db:user:<id>` keeps dependency resolution logical-key
 * based, never a hardcoded target UUID.
 */
export function createPlacesLoadCandidate(rawSource: RawPlaceSourceRepository): (sourceRecordKey: string) => PlacesMigrationCandidate {
  return (sourceRecordKey) => {
    const legacyAuthorId = rawSource.loadLegacyAuthorId(sourceRecordKey);
    const ownerUserSourceRecordKey = `wordpress-db:user:${legacyAuthorId}`;
    const domainHash = rawSource.loadSourceHash(sourceRecordKey);
    return { sourceRecordKey, domainHash, dependencyPlan: { ownerUserSourceRecordKey } };
  };
}

export interface PlacesWriteTransactionClient {
  place: Pick<PrismaClient["place"], "create" | "update" | "findUnique">;
  openingHours: Pick<PrismaClient["openingHours"], "create" | "update">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "create" | "updateMany" | "findUnique" | "findUniqueOrThrow">;
  $transaction<T>(fn: (tx: PlacesWriteTransactionClient) => Promise<T>): Promise<T>;
}

export interface PlacesWriterPrismaClient {
  city: Pick<PrismaClient["city"], "findMany">;
  $transaction<T>(fn: (tx: PlacesWriteTransactionClient) => Promise<T>): Promise<T>;
}

export function createPlacesWriter(
  prisma: PlacesWriterPrismaClient,
  rawSource: RawPlaceSourceRepository,
  sourceId: string,
): (candidate: PlacesMigrationCandidate, dependencies: ResolvedPlacesDependencies) => Promise<PlacesMigrationWriteResult> {
  return async (candidate, dependencies) => {
    const rawCandidate = rawSource.loadNormalizedCandidate(candidate.sourceRecordKey);
    let cityId: string | null = null;
    if (rawCandidate.cityRaw?.trim()) {
      const rawCity = rawCandidate.cityRaw.trim();
      const cities = await prisma.city.findMany({ where: { name: { equals: rawCity, mode: "insensitive" }, isActive: true }, select: { id: true, name: true } });
      if (cities.length !== 1) throw new Error(cities.length ? "PLACE_CITY_DEPENDENCY_AMBIGUOUS" : "PLACE_CITY_DEPENDENCY_NOT_FOUND");
      if (cities[0].name.toLocaleLowerCase("ru") !== rawCity.toLocaleLowerCase("ru")) throw new Error("PLACE_CITY_DEPENDENCY_MISMATCH");
      cityId = cities[0].id;
    } else if (rawCandidate.addressText?.trim()) {
      // Some Voxel records omit `city-place` but retain a structured
      // location address. Accept only an exact comma-delimited city-name
      // segment; substring guessing (for example street "Мира") is forbidden.
      const segments = rawCandidate.addressText.split(",").map((part) => part.trim().toLocaleLowerCase("ru")).filter(Boolean);
      const cities = await prisma.city.findMany({ where: { isActive: true }, select: { id: true, name: true } });
      const matches = cities.filter((city) => segments.includes(city.name.trim().toLocaleLowerCase("ru")));
      if (matches.length > 1) throw new Error("PLACE_CITY_DEPENDENCY_AMBIGUOUS");
      cityId = matches[0]?.id ?? null;
    }
    // Opening hours import is deliberately deferred (same MVP scope as
    // buildPlaceCreateDraft's own media/category/tags deferrals) — this
    // keeps PlaceCommitWriter.createPlaceFromDraft to a single
    // `place.create()` call with no internal nested $transaction, so it
    // can safely run inside this writer's own outer transaction alongside
    // the MigrationLineage create.
    const built = buildPlaceCreateDraft({ candidate: rawCandidate, context: { createdByUserId: dependencies.createdByUserId, cityId } });
    if (!built.ok) throw new Error(`PLACE_DRAFT_INVALID:${built.reasons.map((reason) => reason.code).join("+")}`);
    const draft = { ...built.draft, openingHours: undefined };

    return prisma.$transaction(async (tx) => {
      const writer = new PlaceCommitWriter(tx);
      const written = await writer.createPlaceFromDraft(draft);
      if (dependencies.ownerBusinessId) {
        await tx.place.update({ where: { id: written.placeId }, data: { ownerBusinessId: dependencies.ownerBusinessId } });
      }

      const lineageWriter = new MigrationLineageWriter(tx);
      await lineageWriter.createLineage({
        sourceId,
        sourceEntityType: "wordpress-db:places",
        sourceStableKey: candidate.sourceRecordKey,
        sourceRecordKey: candidate.sourceRecordKey,
        targetType: PLACE_TARGET_TYPE,
        targetId: written.placeId,
        targetStableKey: written.placeId,
        lastSourceHash: candidate.domainHash,
      });

      return { targetId: written.placeId };
    });
  };
}
