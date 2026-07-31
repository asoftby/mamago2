import type { MigrationTargetType, PrismaClient } from "@prisma/client";
import type { NormalizedOfferCandidate } from "../../adapters/wordpress-db/normalizeOffer";
import { buildOfferCreateDraft } from "../../commit/offer/buildOfferCreateDraft";
import { buildOfferDomainHashV2 } from "../../commit/offer/offerDomainHash";
import { OfferCommitWriter } from "../../commit/offer/OfferCommitWriter";
import { collapseOfferPlaceRelations } from "../../commit/offer/collapseOfferPlaceRelations";
import { MigrationLineageWriter } from "../../lineage/MigrationLineageWriter";
import type { MediaPolicyName } from "../../runtime/MigrationProfile";
import type {
  OffersMigrationCandidate,
  OffersMigrationWriteResult,
  OffersTargetLineageState,
  ResolvedOffersDependencies,
} from "./offersAdapter";

/**
 * Real, Prisma-backed implementations of the Offers planning half
 * (`resolveTargetState`/`resolveDependencies`) — everything a read-only
 * DEV plan needs, since neither requires the raw WordPress content, only
 * `sourceRecordKey`/`OfferDomainHashV2`/logical dependency keys already
 * present in the committed release manifest and
 * `phoenix-offers-domain-hash-v2-audit-2026-07-31.json`. Resolves every
 * dependency through `MigrationLineage` (logical keys), never a
 * hardcoded target UUID — matching `scripts/audit-phoenix-offers-plan.ts`'s
 * proven resolution path.
 *
 * The write-path wiring (`createOffersWriter` below) is real production
 * code too, reusing the already-proven `buildOfferCreateDraft` +
 * `OfferCommitWriter` + `MigrationLineageWriter` pipeline from
 * `commit/offer/` — but it depends on a `RawOfferSourceRepository` that
 * this repo cannot supply this session: there is no committed or locally
 * captured raw WordPress bundle for Offers (`~/.mamago2/migration-snapshots/`
 * has `activities`/`articles`/`users`, no `offers`), and capturing one
 * requires `scripts/capture-phoenix-offers-source.ts` against the
 * WordPress source, which is explicitly out of scope for this pass. This
 * is fine for a read-only plan (which never calls `write()`), and the gap
 * is deliberately left visible rather than papered over with fabricated
 * candidate data.
 */

export interface OffersProductionWiringPrismaClient {
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findMany">;
  offer: Pick<PrismaClient["offer"], "findMany" | "create" | "updateMany">;
  place: Pick<PrismaClient["place"], "findUnique">;
  business: Pick<PrismaClient["business"], "findUnique">;
}

const OFFER_TARGET_TYPE: MigrationTargetType = "OFFER";
const PLACE_TARGET_TYPE: MigrationTargetType = "PLACE";

export function createOffersTargetStateResolver(
  prisma: OffersProductionWiringPrismaClient,
  sourceId: string,
): (candidate: OffersMigrationCandidate) => Promise<OffersTargetLineageState> {
  return async (candidate) => {
    const lineages = await prisma.migrationLineage.findMany({
      where: { sourceId, sourceRecordKey: candidate.sourceRecordKey, targetType: OFFER_TARGET_TYPE, targetRole: "primary", isActive: true },
    });
    // Offer.createRequestId is the real idempotency key: buildOfferCreateDraft
    // always sets it to the candidate's sourceRecordKey, so a target lookup
    // by createRequestId never depends on a lineage row existing first.
    const targets = await prisma.offer.findMany({ where: { createRequestId: candidate.sourceRecordKey } });
    return {
      lineageCount: lineages.length,
      targetExists: targets.length >= 1,
      duplicateTarget: targets.length > 1,
      lineageDomainHash: lineages.length === 1 ? lineages[0].lastSourceHash : null,
    };
  };
}

export function createOffersDependencyResolver(
  prisma: OffersProductionWiringPrismaClient,
  sourceId: string,
): (candidate: OffersMigrationCandidate) => Promise<ResolvedOffersDependencies> {
  return async (candidate) => {
    const placeKey = candidate.dependencyPlan.placeSourceRecordKey;
    const placeLineages = await prisma.migrationLineage.findMany({
      where: { sourceId, sourceRecordKey: placeKey, targetType: PLACE_TARGET_TYPE, isActive: true },
    });
    if (placeLineages.length === 0) throw new Error("PLACE_DEPENDENCY_NOT_FOUND");
    if (placeLineages.length > 1) throw new Error("PLACE_DEPENDENCY_AMBIGUOUS");
    const placeTargetId = placeLineages[0].targetId;
    if (!placeTargetId) throw new Error("PLACE_DEPENDENCY_NOT_FOUND");

    const place = await prisma.place.findUnique({
      where: { id: placeTargetId },
      select: { id: true, createdByUserId: true, ownerBusinessId: true, cityId: true },
    });
    if (!place) throw new Error("PLACE_DEPENDENCY_TARGET_MISSING");
    if (!place.cityId) throw new Error("PLACE_DEPENDENCY_MISSING_CITY");
    if (!place.createdByUserId) throw new Error("PLACE_OWNER_RELATION_MISMATCH");

    let businessId: string | null = null;
    if (place.ownerBusinessId) {
      const business = await prisma.business.findUnique({ where: { id: place.ownerBusinessId }, select: { id: true } });
      if (!business) throw new Error("BUSINESS_DEPENDENCY_TARGET_MISSING");
      businessId = business.id;
    }
    // A candidate that expected a business dependency but the resolved
    // Place carries none (or vice versa) is a real Place/Business
    // relation mismatch, not a silent partial match.
    if (candidate.dependencyPlan.businessSourceKey !== null && businessId === null) {
      throw new Error("BUSINESS_DEPENDENCY_NOT_FOUND");
    }
    if (candidate.dependencyPlan.businessSourceKey === null && businessId !== null) {
      throw new Error("BUSINESS_DEPENDENCY_UNEXPECTED");
    }

    return { placeId: place.id, ownerUserId: place.createdByUserId, businessId, cityId: place.cityId };
  };
}

/**
 * Real implementation reads the bounded, immutable raw WordPress capture
 * produced by `scripts/capture-phoenix-release-bundle-source.ts` — see
 * `FrozenOfferSourceRepository`.
 */
export interface RawOfferSourceRepository {
  loadNormalizedCandidate(sourceRecordKey: string): NormalizedOfferCandidate;
}

/**
 * Unlike Article/Event/Route, Offer's `dependencyPlan.businessSourceKey`
 * cannot be determined from raw WordPress content alone — it reflects
 * whether the *target* Place (already migrated, resolved via lineage) has
 * an `ownerBusinessId`, a target-system fact, not a source fact. This
 * mirrors `scripts/audit-phoenix-offers-plan.ts`'s exact resolution: Place
 * via `MigrationLineage`, business presence via `place.ownerBusinessId`.
 * `resolveDependencies` independently re-resolves and validates this same
 * business presence at write time — this function only has to predict it
 * correctly enough to compute the right `OfferDomainHashV2` at plan time;
 * it is never itself trusted as the write-time dependency resolution.
 */
export function createOffersLoadCandidate(
  rawSource: RawOfferSourceRepository,
  prisma: OffersProductionWiringPrismaClient,
  sourceId: string,
): (sourceRecordKey: string) => Promise<OffersMigrationCandidate> {
  return async (sourceRecordKey) => {
    const rawCandidate = rawSource.loadNormalizedCandidate(sourceRecordKey);
    const collapsed = collapseOfferPlaceRelations({ offerPostId: rawCandidate.sourcePostId, relations: rawCandidate.placeRelation.relations });
    if (collapsed.status !== "RESOLVED") throw new Error(`OFFER_PLACE_RELATION_${collapsed.status}`);
    const placeSourceRecordKey = `wordpress-db:places:${collapsed.effectiveLegacyPlaceId}`;

    const placeLineages = await prisma.migrationLineage.findMany({
      where: { sourceId, sourceRecordKey: placeSourceRecordKey, targetType: PLACE_TARGET_TYPE, isActive: true },
    });
    if (placeLineages.length !== 1 || !placeLineages[0].targetId) throw new Error("PLACE_DEPENDENCY_NOT_FOUND");
    const place = await prisma.place.findUnique({ where: { id: placeLineages[0].targetId }, select: { ownerBusinessId: true } });
    if (!place) throw new Error("PLACE_DEPENDENCY_TARGET_MISSING");
    const businessSourceKey = place.ownerBusinessId ? `place-owner-business:${placeSourceRecordKey}` : null;

    const dependencyPlan: OffersMigrationCandidate["dependencyPlan"] = {
      placeSourceRecordKey,
      businessSourceKey,
      placeReadiness: "EXISTS_NOW",
      businessReadiness: businessSourceKey ? "EXISTS_NOW" : null,
    };
    const domainHashV2 = buildOfferDomainHashV2(rawCandidate, {
      placeSourceRecordKey,
      ownerIdentity: { kind: "technicalMigrationCreator", value: "technicalMigrationCreator" },
      businessSourceKey,
    });

    return { sourceRecordKey, domainHashV2, dependencyPlan };
  };
}

/**
 * The narrowest slice either writer needs, available on both a top-level
 * `PrismaClient` and the interactive-transaction client Prisma passes into
 * a `$transaction(async (tx) => ...)` callback — both satisfy this
 * structurally, no cast required.
 */
export interface OffersWriteTransactionClient {
  offer: Pick<PrismaClient["offer"], "create" | "updateMany">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "create" | "updateMany" | "findUnique" | "findUniqueOrThrow">;
}

export interface OffersWriterPrismaClient {
  $transaction<T>(fn: (tx: OffersWriteTransactionClient) => Promise<T>): Promise<T>;
}

export function createOffersWriter(
  prisma: OffersWriterPrismaClient,
  rawSource: RawOfferSourceRepository,
  sourceId: string,
  mediaPolicy: MediaPolicyName,
): (candidate: OffersMigrationCandidate, dependencies: ResolvedOffersDependencies) => Promise<OffersMigrationWriteResult> {
  return async (candidate, dependencies) => {
    const rawCandidate = rawSource.loadNormalizedCandidate(candidate.sourceRecordKey);
    const collapsed = collapseOfferPlaceRelations({ offerPostId: rawCandidate.sourcePostId, relations: rawCandidate.placeRelation.relations });
    if (collapsed.status !== "RESOLVED") throw new Error(`OFFER_PLACE_RELATION_${collapsed.status}`);

    // Defense in depth: the domain hash this candidate was planned against
    // must still match what the raw source + resolved dependencies produce
    // right now, or a stale/tampered candidate could slip past planning.
    const recomputedHash = buildOfferDomainHashV2(rawCandidate, {
      placeSourceRecordKey: candidate.dependencyPlan.placeSourceRecordKey,
      ownerIdentity: { kind: "technicalMigrationCreator", value: "technicalMigrationCreator" },
      businessSourceKey: candidate.dependencyPlan.businessSourceKey,
    });
    if (recomputedHash !== candidate.domainHashV2) throw new Error("DOMAIN_HASH_RECOMPUTE_MISMATCH");

    const built = buildOfferCreateDraft({
      candidate: rawCandidate,
      context: {
        placeId: dependencies.placeId,
        legacyPlaceId: collapsed.effectiveLegacyPlaceId,
        ownerUserId: dependencies.ownerUserId,
        businessId: dependencies.businessId,
        cityId: dependencies.cityId,
        mediaPolicy,
      },
    });
    if (!built.ok) throw new Error(`OFFER_DRAFT_INVALID:${built.reasons.map((reason) => reason.code).join("+")}`);

    // Everything above is pure computation / already-read state; only the
    // actual Offer + MigrationLineage writes need to be atomic, so the
    // transaction is opened as late as possible and scoped to exactly one
    // record — never widened across multiple Offers.
    return prisma.$transaction(async (tx) => {
      const writer = new OfferCommitWriter(tx);
      const written = await writer.createOfferFromDraft(built.draft);
      if (!written.ok) throw new Error(written.errorMessage);

      const lineageWriter = new MigrationLineageWriter(tx);
      await lineageWriter.createLineage({
        sourceId,
        sourceEntityType: "offer",
        sourceStableKey: candidate.sourceRecordKey,
        sourceRecordKey: candidate.sourceRecordKey,
        targetType: OFFER_TARGET_TYPE,
        targetId: written.offerId,
        targetStableKey: written.offerId,
        lastSourceHash: candidate.domainHashV2,
      });

      return { targetId: written.offerId };
    });
  };
}
