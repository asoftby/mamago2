import type { PrismaClient } from "@prisma/client";
import { buildRouteCreateDraft } from "../../commit/route/buildRouteCreateDraft";
import { RouteCommitWriter, type RouteCommitWriterPrismaClient } from "../../commit/route/RouteCommitWriter";
import { MigrationLineageWriter } from "../../lineage/MigrationLineageWriter";
import type { LoadedFrozenRoute } from "./frozenRouteSourceRepository";
import type { RoutesMigrationCandidate, RoutesTargetState } from "./routesAdapter";

export interface RawRouteSourceRepository { load(key: string): LoadedFrozenRoute }
export interface RoutesReadPrismaClient {
  route: Pick<PrismaClient["route"], "findMany" | "findUnique">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findMany">;
}
export function createRoutesCandidateLoader(raw: RawRouteSourceRepository, hashes: ReadonlyMap<string, string>) {
  return (sourceRecordKey: string): RoutesMigrationCandidate => {
    const domainHash = hashes.get(sourceRecordKey); if (!domainHash) throw new Error("FAILED:ROUTE_DOMAIN_HASH_MISSING");
    const loaded = raw.load(sourceRecordKey); if (loaded.sourceHash !== domainHash) throw new Error("RELEASE_BLOCKED:ROUTE_SOURCE_HASH_MISMATCH"); const slug = loaded.normalized.slug.trim(); if (!slug) throw new Error("FAILED:ROUTE_SLUG_MISSING");
    return { sourceRecordKey, domainHash, slug };
  };
}
export function createRoutesTargetStateResolver(prisma: RoutesReadPrismaClient, sourceId: string) {
  return async (candidate: RoutesMigrationCandidate): Promise<RoutesTargetState> => {
    const [lineages, targets] = await Promise.all([
      prisma.migrationLineage.findMany({ where: { sourceId, sourceRecordKey: candidate.sourceRecordKey, targetType: "ROUTE", targetRole: "primary", isActive: true } }),
      prisma.route.findMany({ where: { slug: candidate.slug }, select: { id: true } }),
    ]);
    const targetId = lineages.length === 1 ? lineages[0].targetId : null;
    const lineageTarget = targetId ? await prisma.route.findUnique({ where: { id: targetId }, select: { id: true, slug: true } }) : null;
    return { lineageCount: lineages.length, targetCount: targets.length, lineageTargetExists: Boolean(lineageTarget), lineageDomainHash: lineages.length === 1 ? lineages[0].lastSourceHash : null };
  };
}
export type RoutesWriteTransactionClient = RouteCommitWriterPrismaClient & { migrationLineage: Pick<PrismaClient["migrationLineage"], "create" | "updateMany" | "findUnique" | "findUniqueOrThrow"> };
export interface RoutesWriterPrismaClient { $transaction<T>(fn: (tx: RoutesWriteTransactionClient) => Promise<T>): Promise<T> }
export function createRoutesWriter(prisma: RoutesWriterPrismaClient, raw: RawRouteSourceRepository, sourceId: string) {
  return async (candidate: RoutesMigrationCandidate): Promise<{ targetId: string }> => {
    const loaded = raw.load(candidate.sourceRecordKey);
    if (loaded.sourceHash !== candidate.domainHash) throw new Error("RELEASE_BLOCKED:ROUTE_SOURCE_HASH_MISMATCH");
    if (loaded.normalized.slug.trim() !== candidate.slug) throw new Error("FAILED:ROUTE_NATURAL_IDENTITY_MISMATCH");
    const built = buildRouteCreateDraft({ candidate: loaded.normalized, context: {}, sourceRecordKey: candidate.sourceRecordKey });
    if (!built.ok) throw new Error(`FAILED:ROUTE_DRAFT_INVALID:${built.reasons.map((r) => r.code).join("+")}`);
    return prisma.$transaction(async (tx) => {
      const written = await new RouteCommitWriter(tx).createRouteFromDraft(built.draft);
      if (written.slug !== candidate.slug) throw new Error("CONFLICT:ROUTE_SLUG_RESERVED");
      await new MigrationLineageWriter(tx).createLineage({ sourceId, sourceEntityType: "wordpress-db:routes", sourceStableKey: candidate.sourceRecordKey, sourceRecordKey: candidate.sourceRecordKey, targetType: "ROUTE", targetId: written.routeId, targetStableKey: candidate.slug, lastSourceHash: candidate.domainHash });
      return { targetId: written.routeId };
    });
  };
}
