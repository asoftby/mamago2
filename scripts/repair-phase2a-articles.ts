/**
 * P0 SEO Recovery Phase 2A: PLAN/APPLY for ~21 high-impact articles.
 *
 * Extends the proven Phase 1B recovery pattern to the next tier of
 * migrated-but-unpublished articles.
 *
 * Phase 1B did 9 articles. Phase 2A targets ~21 articles from the P2-A
 * priority batch (RESTORE_EXISTING_CONTENT + READY_AUTOMATED).
 *
 * Usage:
 *   PLAN:  set -a; source .env; set +a; npx tsx scripts/repair-phase2a-articles.ts
 *   APPLY: set -a; source .env; set +a; npx tsx scripts/repair-phase2a-articles.ts --apply
 *
 * Only affects articles classified READY_AUTOMATED with RESTORE_EXISTING_CONTENT
 * action and entityType=article. BLOCKED_OWNER_REVIEW rows are listed for
 * informational purposes but never touched.
 *
 * Follows the same protocol as repair-migrated-article-publication-geo.ts:
 * - PROD-writes are intentional manual --apply
 * - Atomic updateMany with precondition guards
 * - SearchDocument strict reindex after transaction
 * - Resumable idempotent behavior
 */
import { DEFAULT_COUNTRY_ISO } from "../src/server/geo/geoConstants";
import { prismaBase, searchIndexer } from "../src/lib/prisma";
import { MINSK_CITY_SLUG } from "../src/lib/seo/migratedArticlePublicationGeoRecovery";
import {
  applyPublicationGeoPlan,
  buildPublicationGeoPlan,
  resolveMinskCity,
  summarizePublicationGeoPlan,
} from "../src/lib/seo/migratedArticlePublicationGeoRepair";
import {
  PHASE_2A_PRIORITY_RECOVERIES,
  summarizePhase2A,
  validatePhase2AIntegrity,
} from "../src/lib/seo/phase2aPriorityRecovery";
import type { MigratedArticlePublicationGeoRecovery } from "../src/lib/seo/migratedArticlePublicationGeoRecovery";

const apply = process.argv.includes("--apply");

async function main() {
  // 1. Validate Phase 2A data integrity
  const integrityErrors = validatePhase2AIntegrity();
  if (integrityErrors.length > 0) {
    console.error("Phase 2A data integrity errors:");
    for (const err of integrityErrors) console.error(`  ${err}`);
    process.exitCode = 1;
    return;
  }

  // 2. Summary of Phase 2A data
  const summary = summarizePhase2A();
  console.log("=== PHASE 2A PRIORITY DATA SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));

  // 3. List OWNER-REVIEW blocked rows
  const blockedByBatch = PHASE_2A_PRIORITY_RECOVERIES.filter(
    (e) => e.readiness === "BLOCKED_OWNER_REVIEW",
  );
  console.log(`\n=== OWNER-REVIEW BLOCKED (${blockedByBatch.length} rows) ===`);
  for (const entry of blockedByBatch) {
    console.log(
      `${entry.position}. ${entry.legacySourcePath} (${entry.gscClicks} clicks) [${entry.ownerReviewBatch}]`,
    );
    console.log(`   Evidence: ${entry.evidence}`);
  }

  // 4. Identify READY_AUTOMATED articles for RESTORE_EXISTING_CONTENT
  const readyArticles = PHASE_2A_PRIORITY_RECOVERIES.filter(
    (e) =>
      e.entityType === "article" &&
      e.action === "RESTORE_EXISTING_CONTENT" &&
      e.readiness === "READY_AUTOMATED" &&
      e.geoScope !== null,
  );

  console.log(`\n=== READY_AUTOMATED RESTORE ARTICLES (${readyArticles.length} rows) ===`);
  for (const entry of readyArticles) {
    const expectedPath =
      entry.geoScope === "CITY"
        ? `/${entry.citySlug}/blog/${entry.currentSlug}`
        : `/blog/${entry.currentSlug}`;
    console.log(
      `${entry.position}. ${entry.legacySourcePath} -> ${expectedPath} (${entry.gscClicks} clicks, ${entry.confidence})`,
    );
  }

  // 5. Resolve Minsk city
  const minskCity = await resolveMinskCity(prismaBase);
  if (!minskCity) {
    throw new Error(
      `[repair-phase2a-articles] City not found: ` +
        `slug=${MINSK_CITY_SLUG} country=${DEFAULT_COUNTRY_ISO} isActive=true isLegacyNonCity=false`,
    );
  }

  // 6. For each READY_AUTOMATED article, find the article by slug and build recovery records
  const recoveryRecords: MigratedArticlePublicationGeoRecovery[] = [];

  console.log("\n=== BUILDING RECOVERY RECORDS (PROD read) ===");
  for (const entry of readyArticles) {
    // Find article by current slug
    const article = await prismaBase.article.findFirst({
      where: { slug: entry.currentSlug },
      select: {
        id: true,
        title: true,
        status: true,
        geoScope: true,
        cityId: true,
        regionId: true,
        slug: true,
        updatedAt: true,
        publishedAt: true,
        noindex: true,
        seoRobots: true,
        contentJson: true,
      },
    });

    if (!article) {
      console.error(
        `  [NOT_FOUND] Position ${entry.position}: slug "${entry.currentSlug}" not found in DB`,
      );
      continue;
    }

    const blocksCount = article.contentJson
      ? ((article.contentJson as Record<string, unknown>)?.blocks as unknown[] | undefined)
            ?.length ?? 0
      : 0;

    const record: MigratedArticlePublicationGeoRecovery = {
      articleId: article.id,
      title: article.title,
      auditedTitle: article.title,
      currentSlug: entry.currentSlug,
      legacyUrl: entry.legacySourcePath,
      geoScope: entry.geoScope as "CITY" | "COUNTRY",
      citySlug: entry.citySlug,
      confidence: entry.confidence as "HIGH" | "MEDIUM",
      reason: entry.evidence,
      expectedUpdatedAt: article.updatedAt?.toISOString() ?? "",
      auditedPublishedAt: article.publishedAt?.toISOString() ?? "",
      auditedNoindex: article.noindex,
      auditedSeoRobots: article.seoRobots,
      auditedBlocksCount: blocksCount,
    };

    recoveryRecords.push(record);
    console.log(
      `  [FOUND] Position ${entry.position}: articleId=${article.id} status=${article.status} ` +
        `slug=${article.slug} blocks=${blocksCount}`,
    );
  }

  console.log(`\nTotal recovery records built: ${recoveryRecords.length}`);

  if (recoveryRecords.length === 0) {
    console.warn("No recovery records could be built. Nothing to do.");
    if (apply) {
      console.log("APPLY mode: no rows to process.");
    }
    return;
  }

  // 7. Build the PLAN
  console.log("\n=== PHASE 2A ARTICLE PUBLICATION/GEO PLAN ===");
  const plan = await buildPublicationGeoPlan(prismaBase, recoveryRecords, minskCity.id);
  for (const row of plan) {
    console.log(JSON.stringify(row, null, 2));
  }

  const planSummary = summarizePublicationGeoPlan(plan, apply ? "apply" : "plan");
  console.log("\n=== PLAN SUMMARY ===");
  console.log(JSON.stringify(planSummary, null, 2));

  // 8. Print ACTION plan for non-article entries
  const redirectRecurring = PHASE_2A_PRIORITY_RECOVERIES.filter(
    (e) => e.action === "SEMANTIC_REDIRECT" || e.action === "UPDATE_RECURRING_OR_SEASONAL",
  );
  console.log(`\n=== NON-ARTICLE ACTION PLAN (${redirectRecurring.length} rows) ===`);
  console.log("These rows require redirect-map updates or event creation, not article publication.");
  console.log("They must be addressed separately after article recovery is verified.");

  if (!apply) {
    console.log(
      `\n=== READ-ONLY PLAN COMPLETE ===\n` +
        `PROD_WRITES=0\n` +
        `To apply: re-run with --apply\n` +
        `Apply candidates: ${planSummary.apply} row(s)\n` +
        `Already applied: ${planSummary.already_applied} row(s)\n` +
        `Conflicts: ${planSummary.conflict} row(s)\n` +
        `Blocked owner review: ${blockedByBatch.length} row(s)`,
    );
    return;
  }

  // 9. APPLY
  console.log("\n=== APPLYING PHASE 2A ARTICLE RECOVERY ===");
  const result = await applyPublicationGeoPlan(prismaBase, plan, searchIndexer);
  console.log(
    `[repair-phase2a-articles] Applied ${result.applied} row(s); ` +
      `reindexed+verified ${result.reindexed} row(s).`,
  );
  for (const verification of result.verifications) {
    console.log(
      `SEARCH_INDEX articleId=${verification.articleId} PASS urlPath=${verification.urlPath}`,
    );
  }
}

main()
  .catch((error) => {
    console.error("[repair-phase2a-articles]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaBase.$disconnect();
  });