import type { PrismaClient } from "@prisma/client";

import { BUSINESS_OWNERSHIP_SOURCE_NAMESPACE } from "./BusinessOwnershipGoldenRunner";
import type { RoleElevationGoldenCandidate } from "./RoleElevationGoldenRunner";

/**
 * Builds the batch role-elevation manifest live from current DB state:
 * every `sourceRecordKey` that already has an active BUSINESS
 * MigrationLineage row (i.e. ownership was already written by Slice 7/8)
 * is a candidate, except any explicitly excluded key (the golden
 * candidate already elevated in Slice 9). No snapshot read is needed here
 * — unlike the ownership manifest, role eligibility is fully determined
 * by lineage + User state already in the DB.
 */
export async function buildRoleElevationBatchManifest(
  prisma: PrismaClient,
  excludeSourceRecordKeys: readonly string[] = [],
  sourceNamespace: string = BUSINESS_OWNERSHIP_SOURCE_NAMESPACE,
): Promise<readonly RoleElevationGoldenCandidate[]> {
  const source = await prisma.migrationSource.findUnique({ where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace } } });
  if (!source) return [];

  const businessLineages = await prisma.migrationLineage.findMany({
    where: { sourceId: source.id, targetType: "BUSINESS", isActive: true },
    select: { sourceRecordKey: true },
  });

  const excluded = new Set(excludeSourceRecordKeys);
  return businessLineages
    .map(lineage => lineage.sourceRecordKey)
    .filter(sourceRecordKey => !excluded.has(sourceRecordKey))
    .sort()
    .map(sourceRecordKey => ({ sourceRecordKey }));
}
