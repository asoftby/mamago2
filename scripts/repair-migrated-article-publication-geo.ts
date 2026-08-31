/**
 * P0 SEO Recovery Phase 1B: idempotent PLAN/APPLY repair that recovers
 * publication state and geography for the 9 migrated articles Phase 1
 * (PR #159) left at `status=PENDING`, `geoScope=NULL`, `cityId=NULL`.
 *
 * Usage:
 *   PLAN:  set -a; source .env; set +a; npx tsx scripts/repair-migrated-article-publication-geo.ts
 *   APPLY: set -a; source .env; set +a; npx tsx scripts/repair-migrated-article-publication-geo.ts --apply
 *
 * Only the 9 hard-coded articles in
 * src/lib/seo/migratedArticlePublicationGeoRecovery.ts are touched. APPLY
 * only ever changes Article.status/geoScope/cityId; every other field
 * (slug, title, contentJson, publishedAt, createdAt, author, categories,
 * tags, noindex, seoRobots) is read for precondition verification only and
 * is never written. Fails closed (no writes, non-zero exit) if any row's
 * current DB state does not exactly match either the expected pre-repair
 * precondition or the already-applied target state.
 *
 * PROD writes are intentionally manual and out-of-band, same as Phase 1.
 */
import { PrismaClient } from "@prisma/client";
import {
  MIGRATED_ARTICLE_PUBLICATION_GEO_RECOVERIES,
  MINSK_CITY_SLUG,
} from "../src/lib/seo/migratedArticlePublicationGeoRecovery";
import {
  applyPublicationGeoPlan,
  buildPublicationGeoPlan,
  summarizePublicationGeoPlan,
} from "../src/lib/seo/migratedArticlePublicationGeoRepair";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const minskCity = await prisma.city.findFirst({
    where: { slug: MINSK_CITY_SLUG },
    select: { id: true },
  });
  if (!minskCity) {
    throw new Error(
      `[repair-migrated-article-publication-geo] City not found: slug=${MINSK_CITY_SLUG}`,
    );
  }

  const plan = await buildPublicationGeoPlan(
    prisma,
    MIGRATED_ARTICLE_PUBLICATION_GEO_RECOVERIES,
    minskCity.id,
  );

  console.log("=== MIGRATED ARTICLE PUBLICATION/GEO REPAIR PLAN ===");
  for (const row of plan) console.log(JSON.stringify(row));

  const summary = summarizePublicationGeoPlan(plan, apply ? "apply" : "plan");
  console.log("=== SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));

  if (!apply) return;

  const result = await applyPublicationGeoPlan(prisma, plan);
  console.log(`[repair-migrated-article-publication-geo] Applied ${result.applied} row(s).`);
}

main()
  .catch((error) => {
    console.error("[repair-migrated-article-publication-geo]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
