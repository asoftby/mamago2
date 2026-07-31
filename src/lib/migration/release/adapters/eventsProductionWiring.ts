import type { PrismaClient } from "@prisma/client";
import { runAtomicEventCreate, type EventCreateTransactionClient } from "../../commit/event/runAtomicEventCreate";
import type { EventCommitContext } from "../../commit/event/types";
import type { EventsMigrationCandidate, EventsPhasePreflightResult, EventsTargetState } from "./eventsAdapter";
import type { LoadedFrozenEvent } from "./frozenEventSourceRepository";

export interface EventsReadPrismaClient {
  activity: Pick<PrismaClient["activity"], "findMany" | "findUnique">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findMany">;
  user: Pick<PrismaClient["user"], "findUnique">;
  place: Pick<PrismaClient["place"], "findUnique">;
}

export function createEventsPhasePreflight(prisma: EventsReadPrismaClient): () => Promise<EventsPhasePreflightResult> {
  return async () => {
    const [activities, lineages] = await Promise.all([
      prisma.activity.findMany({ select: { id: true } }),
      prisma.migrationLineage.findMany({ where: { targetType: "ACTIVITY", isActive: true }, select: { sourceRecordKey: true, targetId: true } }),
    ]);
    const activityIds = new Set(activities.map((row) => row.id));
    const sourceCounts = new Map<string, number>();
    const targetCounts = new Map<string, number>();
    for (const row of lineages) {
      sourceCounts.set(row.sourceRecordKey, (sourceCounts.get(row.sourceRecordKey) ?? 0) + 1);
      if (row.targetId) targetCounts.set(row.targetId, (targetCounts.get(row.targetId) ?? 0) + 1);
    }
    const duplicateSourceRecordKeys = [...sourceCounts].filter(([, count]) => count > 1).map(([key]) => key).sort();
    const duplicateTargetIds = [...targetCounts].filter(([, count]) => count > 1).map(([id]) => id).sort();
    const missingTargetIds = [...new Set(lineages.map((row) => row.targetId).filter((id): id is string => Boolean(id) && !activityIds.has(id!)))].sort();
    const linedTargetIds = new Set(lineages.map((row) => row.targetId).filter((id): id is string => Boolean(id)));
    const activityWithoutLineageIds = activities.map((row) => row.id).filter((id) => !linedTargetIds.has(id)).sort();
    const blocker = activityWithoutLineageIds.length ? "EVENTS_UNCLASSIFIABLE_TARGET_STATE"
      : duplicateSourceRecordKeys.length ? "DUPLICATE_LINEAGE"
      : duplicateTargetIds.length ? "DUPLICATE_LINEAGE_TARGET"
      : missingTargetIds.length ? "LINEAGE_WITHOUT_TARGET" : null;
    return { ok: blocker === null, blocker, activityWithoutLineageIds, duplicateSourceRecordKeys, duplicateTargetIds, missingTargetIds };
  };
}

export function createEventsTargetStateResolver(prisma: EventsReadPrismaClient, sourceId: string): (candidate: EventsMigrationCandidate) => Promise<EventsTargetState> {
  return async (candidate) => {
    const lineages = await prisma.migrationLineage.findMany({ where: { sourceId, sourceRecordKey: candidate.sourceRecordKey, targetType: "ACTIVITY", targetRole: "primary", isActive: true } });
    const targetId = lineages.length === 1 ? lineages[0].targetId : null;
    const target = targetId ? await prisma.activity.findUnique({ where: { id: targetId }, select: { id: true } }) : null;
    const targetLineages = targetId ? await prisma.migrationLineage.findMany({ where: { targetType: "ACTIVITY", targetId, isActive: true } }) : [];
    return { lineageCount: lineages.length, targetExists: Boolean(target), lineageDomainHash: lineages.length === 1 ? lineages[0].lastSourceHash : null, duplicateLineageTarget: targetLineages.length > 1 };
  };
}

async function resolveDependencies(prisma: EventsReadPrismaClient, candidate: EventsMigrationCandidate): Promise<EventCommitContext> {
  const owners = await prisma.migrationLineage.findMany({ where: { sourceRecordKey: candidate.ownerUserSourceRecordKey, targetType: "USER", isActive: true } });
  if (owners.length === 0) throw new Error("FAILED:EVENT_OWNER_DEPENDENCY_NOT_FOUND");
  if (owners.length > 1) throw new Error("FAILED:EVENT_OWNER_DEPENDENCY_AMBIGUOUS");
  const ownerId = owners[0].targetId;
  if (!ownerId || !(await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true } }))) throw new Error("FAILED:EVENT_OWNER_TARGET_MISSING");
  const context: EventCommitContext = { ownerUserId: ownerId };
  if (candidate.placeSourceRecordKey) {
    const places = await prisma.migrationLineage.findMany({ where: { sourceRecordKey: candidate.placeSourceRecordKey, targetType: "PLACE", isActive: true } });
    if (places.length !== 1) throw new Error(places.length ? "FAILED:EVENT_PLACE_DEPENDENCY_AMBIGUOUS" : "FAILED:EVENT_PLACE_DEPENDENCY_NOT_FOUND");
    const placeId = places[0].targetId;
    const place = placeId ? await prisma.place.findUnique({ where: { id: placeId }, select: { id: true, cityId: true, createdByUserId: true, ownerBusinessId: true } }) : null;
    if (!place) throw new Error("FAILED:EVENT_PLACE_TARGET_MISSING");
    if (place.createdByUserId !== ownerId) throw new Error("FAILED:EVENT_PLACE_OWNER_RELATION_MISMATCH");
    context.placeId = place.id; context.cityId = place.cityId;
  }
  return context;
}

export interface EventsWriterPrismaClient extends EventsReadPrismaClient {
  $transaction<T>(fn: (tx: EventCreateTransactionClient) => Promise<T>): Promise<T>;
}

export interface RawEventSourceRepository { load(sourceRecordKey: string): LoadedFrozenEvent }

export function createEventsWriter(prisma: EventsWriterPrismaClient, rawSource: RawEventSourceRepository, sourceId: string) {
  return async (candidate: EventsMigrationCandidate): Promise<{ targetId: string }> => {
    const loaded = rawSource.load(candidate.sourceRecordKey);
    if (loaded.ownerUserSourceRecordKey !== candidate.ownerUserSourceRecordKey || loaded.placeSourceRecordKey !== candidate.placeSourceRecordKey) throw new Error("FAILED:EVENT_DEPENDENCY_PLAN_MISMATCH");
    const context = await resolveDependencies(prisma, candidate);
    return prisma.$transaction(async (tx) => {
      const result = await runAtomicEventCreate(tx, { candidate: loaded.normalized, context, lineageInput: {
        sourceId, sourceEntityType: "wordpress-db:events", sourceStableKey: candidate.sourceRecordKey,
        sourceRecordKey: candidate.sourceRecordKey, targetType: "ACTIVITY", lastSourceHash: candidate.domainHash,
      } });
      if (!result.ok) throw new Error(`FAILED:EVENT_DRAFT_INVALID:${result.blockReasons.map((reason) => reason.code).join("+")}`);
      return { targetId: result.activityId };
    });
  };
}

export function createEventsCandidateLoader(rawSource: RawEventSourceRepository, domainHashes: ReadonlyMap<string, string>) {
  return (sourceRecordKey: string): EventsMigrationCandidate => {
    const hash = domainHashes.get(sourceRecordKey);
    if (!hash) throw new Error("FAILED:EVENT_DOMAIN_HASH_MISSING");
    const loaded = rawSource.load(sourceRecordKey);
    return { sourceRecordKey, domainHash: hash, ownerUserSourceRecordKey: loaded.ownerUserSourceRecordKey, placeSourceRecordKey: loaded.placeSourceRecordKey };
  };
}
