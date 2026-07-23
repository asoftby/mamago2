import type { PrismaClient } from "@prisma/client";

import { planBusinessOwnership } from "@/lib/migration/planning/user-ownership/businessOwnershipPlanner";
import { createReadOnlyPrismaClient, createUserOwnershipReadOnlyRepository } from "@/lib/migration/planning/user-ownership/readOnlyRepository";
import { loadBusinessOwnershipEvidence, loadClassification, legacyUserIdFromSourceRecordKey } from "@/lib/migration/planning/user-ownership/snapshotEvidence";

import type { BusinessOwnershipGoldenCandidate } from "./BusinessOwnershipGoldenRunner";

/**
 * Rebuilds the batch write manifest live from the immutable snapshot +
 * current DB state, reusing the exact same (already tested) Slice 6
 * read-only reconciliation logic — rather than trusting the static
 * committed `docs/migration/business-ownership-plan.json`, which reflects
 * DB state only as of when Slice 6 ran and can go stale as writes land.
 *
 * Only `EXACT_LINK_CANDIDATE` entries are included; anything reclassified
 * since Slice 6 (e.g. a conflict that has since appeared) is silently
 * excluded here — the batch runner will still re-verify every
 * precondition per-candidate at write time.
 */
export async function buildBusinessOwnershipBatchManifest(
  prisma: PrismaClient,
  snapshotRoot: string,
  excludeSourceRecordKeys: readonly string[] = [],
): Promise<readonly BusinessOwnershipGoldenCandidate[]> {
  const readOnlyClient = createReadOnlyPrismaClient(prisma);
  const repository = createUserOwnershipReadOnlyRepository(readOnlyClient);

  const classification = loadClassification(snapshotRoot);
  const evidence = loadBusinessOwnershipEvidence(snapshotRoot, classification.businessLinked);
  const plan = await planBusinessOwnership(evidence, repository);

  const excluded = new Set(excludeSourceRecordKeys);
  const evidenceByKey = new Map(evidence.map(item => [item.sourceRecordKey, item]));

  return plan
    .filter(entry => entry.action === "EXACT_LINK_CANDIDATE" && !excluded.has(entry.sourceRecordKey))
    .map(entry => {
      const sourceEvidence = evidenceByKey.get(entry.sourceRecordKey);
      if (!sourceEvidence) throw new Error(`Missing source evidence for ${entry.sourceRecordKey}.`);
      return { sourceRecordKey: entry.sourceRecordKey, legacyUserId: legacyUserIdFromSourceRecordKey(entry.sourceRecordKey), placeSourcePostIds: sourceEvidence.placePostIds };
    })
    .sort((a, b) => (a.sourceRecordKey < b.sourceRecordKey ? -1 : 1));
}
