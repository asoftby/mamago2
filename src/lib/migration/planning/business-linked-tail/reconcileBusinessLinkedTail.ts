import { canonicalHash } from "@/lib/migration/planning/user-ownership/canonicalJson";
import type { ReadOnlyExtendedClient } from "@/lib/migration/planning/user-ownership/readOnlyRepository";
import { loadBusinessOwnershipEvidence } from "@/lib/migration/planning/user-ownership/snapshotEvidence";

import { loadPlaceSourceStatuses } from "./snapshotPlaceStatus";
import type { PlaceCoverageBreakdown, TailReconciliationEntry, TailReconciliationVerdict } from "./types";

function placeSourceRecordKey(postId: string): string {
  return `wordpress-db:places:${postId}`;
}

export function classifyTailReconciliation(
  userLineagePresent: boolean,
  placeCoverage: PlaceCoverageBreakdown,
  migratedPlacesConflictFree: boolean,
  anyMissingPlaceEverAttempted: boolean,
): TailReconciliationVerdict {
  if (!userLineagePresent) return "FOUNDER_DECISION_REQUIRED";
  if (!migratedPlacesConflictFree) return "CONFLICT";
  if (placeCoverage.missingPlaces === 0) return "SAFE_FUTURE_CANDIDATE";
  // Every missing Place has a deterministic, attributable reason (source status) and none were ever attempted-and-failed: a clean, non-ambiguous gap.
  const allMissingAttributedToStatus = Object.values(placeCoverage.missingPlacesBySourceStatus).reduce((a, b) => a + b, 0) === placeCoverage.missingPlaces;
  if (allMissingAttributedToStatus && !anyMissingPlaceEverAttempted) return "TARGET_PLACE_NOT_MIGRATED";
  return "AMBIGUOUS";
}

/**
 * Read-only reconciliation for exactly the business-linked users whose
 * owned-Place lineage coverage was partial in Slice 6/7/8. Never matches
 * by title/slug/email — every Place is resolved through its exact
 * `MigrationLineage.sourceRecordKey`, and "already attempted" is
 * determined from real `MigrationRecord` history, not inferred.
 */
export async function reconcileBusinessLinkedTail(
  client: ReadOnlyExtendedClient,
  snapshotRoot: string,
  sourceRecordKeys: readonly string[],
): Promise<readonly TailReconciliationEntry[]> {
  const evidence = loadBusinessOwnershipEvidence(snapshotRoot, sourceRecordKeys);

  const entries: TailReconciliationEntry[] = [];
  for (const item of evidence) {
    const userLineage = await client.migrationLineage.findFirst({ where: { targetType: "USER", sourceRecordKey: item.sourceRecordKey, isActive: true }, select: { targetId: true } });
    const userLineagePresent = Boolean(userLineage?.targetId);

    const placeKeys = item.placePostIds.map(placeSourceRecordKey);
    const placeLineages = await client.migrationLineage.findMany({
      where: { targetType: "PLACE", isActive: true, sourceRecordKey: { in: placeKeys } },
      select: { sourceRecordKey: true, targetId: true },
    });
    const migratedKeys = new Set(placeLineages.filter(row => row.targetId).map(row => row.sourceRecordKey));
    const missingPostIds = item.placePostIds.filter(postId => !migratedKeys.has(placeSourceRecordKey(postId)));

    const statusByPostId = loadPlaceSourceStatuses(snapshotRoot, missingPostIds);
    const missingPlacesBySourceStatus: Record<string, number> = {};
    for (const postId of missingPostIds) {
      const status = statusByPostId.get(postId) ?? "UNKNOWN";
      missingPlacesBySourceStatus[status] = (missingPlacesBySourceStatus[status] ?? 0) + 1;
    }

    const migratedTargetIds = placeLineages.filter(row => row.targetId).map(row => row.targetId!);
    const migratedPlaces = migratedTargetIds.length > 0 ? await client.place.findMany({ where: { id: { in: migratedTargetIds } }, select: { ownerBusinessId: true } }) : [];
    const ownedBusinessIds = migratedPlaces.map(place => place.ownerBusinessId).filter((id): id is string => id !== null);
    const owningBusinesses = ownedBusinessIds.length > 0 ? await client.business.findMany({ where: { id: { in: ownedBusinessIds } }, select: { id: true, ownerUserId: true } }) : [];
    const businessOwnerById = new Map(owningBusinesses.map(business => [business.id, business.ownerUserId]));
    // A Place already linked to a Business owned by this same target User is not a conflict — it's the intended state (e.g. written by an earlier golden-proof slice).
    const migratedPlacesConflictFree = migratedPlaces.every(place => place.ownerBusinessId === null || businessOwnerById.get(place.ownerBusinessId) === userLineage?.targetId);

    const missingSourceRecordKeys = missingPostIds.map(placeSourceRecordKey);
    const missingRecords = missingSourceRecordKeys.length > 0 ? await client.migrationRecord.findMany({ where: { sourceRecordKey: { in: missingSourceRecordKeys } }, select: { id: true } }) : [];
    const anyMissingPlaceEverAttempted = missingRecords.length > 0;

    const placeCoverage: PlaceCoverageBreakdown = {
      totalOwnedPlaces: item.placePostIds.length,
      migratedPlaces: migratedTargetIds.length,
      missingPlaces: missingPostIds.length,
      missingPlacesBySourceStatus,
    };

    const verdict = classifyTailReconciliation(userLineagePresent, placeCoverage, migratedPlacesConflictFree, anyMissingPlaceEverAttempted);

    const entryCore = { sourceRecordKey: item.sourceRecordKey, userLineagePresent, placeCoverage, migratedPlacesConflictFree, anyMissingPlaceEverAttempted, verdict };
    entries.push({ ...entryCore, evidenceHash: canonicalHash(entryCore) });
  }

  return entries.sort((a, b) => (a.sourceRecordKey < b.sourceRecordKey ? -1 : 1));
}
