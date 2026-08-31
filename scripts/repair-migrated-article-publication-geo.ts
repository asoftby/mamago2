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
 * tags, noindex, seoRobots) is read for precondition or audited-state
 * verification only and is never written. Fails closed (no writes, non-zero
 * exit) if any row's current DB state does not exactly match either the
 * expected pre-repair precondition or the already-applied target state.
 *
 * The Minsk city lookup is scoped to Belarus (DEFAULT_COUNTRY_ISO="BY"),
 * requires isLegacyNonCity=false and isActive=true, and fails if exactly
 * one valid Minsk city cannot be resolved. This prevents a same-slug city
 * in another country from being inadvertently selected.
 *
 * Uses the app's shared `prisma`/`searchIndexer` (src/lib/prisma.ts), not a
 * bare `new PrismaClient()`. After a successful APPLY, each newly-published
 * article is explicitly reindexed via `searchIndexer.upsertArticle`
 * (awaited after the transaction commits — same pattern the normal
 * publication path uses in articleAdminService.ts), so the 9 recovered
 * articles are visible in site search immediately, not just after some
 * unrelated future full reindex.
 *
 * PROD writes are intentionally manual and out-of-band, same as Phase 1.
 */
import { DEFAULT_COUNTRY_ISO } from "../src/server/geo/geoConstants";
import prisma, { searchIndexer } from "../src/lib/prisma";
import {
  MIGRATED_ARTICLE_PUBLICATION_GEO_RECOVERIES,
  MINSK_CITY_SLUG,
} from "../src/lib/seo/migratedArticlePublicationGeoRecovery";
import {
  applyPublicationGeoPlan,
  buildPublicationGeoPlan,
  resolveMinskCity,
  summarizePublicationGeoPlan,
} from "../src/lib/seo/migratedArticlePublicationGeoRepair";

const apply = process.argv.includes("--apply");

async function main() {
  // Unambiguous Belarus/non-legacy Minsk lookup (shared with the test
  // suite via resolveMinskCity — see migratedArticlePublicationGeoRepair.ts).
  // Fails if no valid Minsk city can be resolved; a same-slug city outside
  // Belarus can never be selected because slug is unique per-country.
  const minskCity = await resolveMinskCity(prisma);
  if (!minskCity) {
    throw new Error(
      `[repair-migrated-article-publication-geo] City not found: ` +
        `slug=${MINSK_CITY_SLUG} country=${DEFAULT_COUNTRY_ISO} isActive=true isLegacyNonCity=false`,
    );
  }

  const plan = await buildPublicationGeoPlan(
    prisma,
    MIGRATED_ARTICLE_PUBLICATION_GEO_RECOVERIES,
    minskCity.id,
  );

  console.log("=== MIGRATED ARTICLE PUBLICATION/GEO REPAIR PLAN ===");
  for (const row of plan) console.log(JSON.stringify(row, null, 2));

  const summary = summarizePublicationGeoPlan(plan, apply ? "apply" : "plan");
  console.log("=== SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));

  if (!apply) return;

  const result = await applyPublicationGeoPlan(
    prisma,
    plan,
    MIGRATED_ARTICLE_PUBLICATION_GEO_RECOVERIES,
    searchIndexer,
  );
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