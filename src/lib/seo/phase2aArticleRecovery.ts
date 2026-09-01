/**
 * Phase 2A article publication/geo repair: extends the proven Phase 1B
 * pattern to ~21 additional high-impact articles.
 *
 * These articles are in the same state the Phase 1B articles were:
 * migrated from WP, status=PENDING, geoScope=NULL, cityId=NULL, with
 * existing WP content in contentJson, but never published on mamaGo 2.0.
 *
 * The recovery follows the same PLAN/APPLY pattern as
 * migratedArticlePublicationGeoRepair.ts — same atomic guards, same
 * audited-state fingerprint verification, same strict search reindex.
 */
import type { PrismaClient } from "@prisma/client";
import type { MigratedArticlePublicationGeoRecovery } from "./migratedArticlePublicationGeoRecovery";
import {
  applyPublicationGeoPlan,
  buildPublicationGeoPlan,
  resolveMinskCity,
  summarizePublicationGeoPlan,
  verifySearchDocument,
} from "./migratedArticlePublicationGeoRepair";
import type { StrictArticleSearchIndexer, SearchDocumentVerification } from "./migratedArticlePublicationGeoRepair";
import {
  PHASE_2A_PRIORITY_RECOVERIES,
} from "./phase2aPriorityRecovery";

/**
 * Build the Phase 1B-style recovery records for RESTORE_EXISTING_CONTENT
 * articles. Each record includes evidence-based geoScope and an audited-state
 * placeholder that will be filled in by the PROD read-only PLAN.
 *
 * Returns only entries classified READY_AUTOMATED with RESTORE_EXISTING_CONTENT
 * action and entityType=article.
 */
export function buildArticleRecoveryRecords(): MigratedArticlePublicationGeoRecovery[] {
  const articleEntries = PHASE_2A_PRIORITY_RECOVERIES.filter(
    (e) =>
      e.entityType === "article" &&
      e.action === "RESTORE_EXISTING_CONTENT" &&
      e.readiness === "READY_AUTOMATED" &&
      e.geoScope !== null,
  );

  return articleEntries.map((entry) => ({
    articleId: entry.targetArticleId!,
    title: "", // Filled in by PROD PLAN
    auditedTitle: "", // Filled in by PROD PLAN
    currentSlug: entry.currentSlug,
    legacyUrl: entry.legacySourcePath,
    geoScope: entry.geoScope as "CITY" | "COUNTRY",
    citySlug: (entry.citySlug ?? null) as "minsk" | null,
    confidence: entry.confidence as "HIGH" | "MEDIUM",
    reason: entry.evidence,
    expectedUpdatedAt: "", // Filled in by PROD PLAN
    auditedPublishedAt: "", // Filled in by PROD PLAN
    auditedNoindex: false, // Default — verified by PLAN
    auditedSeoRobots: null, // Default — verified by PLAN
    auditedBlocksCount: 0, // Filled in by PROD PLAN
  }));
}

/**
 * After the PROD PLAN has resolved article IDs, build a full plan from the
 * recovery records and classify each row.
 */
export async function buildPhase2AArticlePlan(
  prisma: PrismaClient,
  records: MigratedArticlePublicationGeoRecovery[],
  minskCityId: string,
) {
  return buildPublicationGeoPlan(prisma, records, minskCityId);
}

export {
  applyPublicationGeoPlan,
  buildPublicationGeoPlan,
  resolveMinskCity,
  summarizePublicationGeoPlan,
  verifySearchDocument,
};
export type { StrictArticleSearchIndexer, SearchDocumentVerification };
