import type { GeoScope } from "@prisma/client";

/**
 * Deterministic GLOBAL/CITY/UNKNOWN classification for one Article, from
 * its own `geoScope`/`cityId` fields only — never from title text, never a
 * guessed default. `Article.geoScope` is a required editor decision before
 * publish (`PublicationGeoScopeField`) and is `NULL` on every record the
 * WordPress import pipeline creates (`ArticleCommitWriter` deliberately
 * never sets it — see `docs/migration/wordpress-to-mamago.md`), so a
 * migrated Article with no editor review yet is `UNKNOWN`, not silently
 * defaulted to COUNTRY or to the launch city.
 */
export type ArticleScopeClassification =
  | { scope: "GLOBAL" }
  | { scope: "CITY"; cityId: string }
  | { scope: "UNKNOWN" };

export function classifyArticleScope(article: { geoScope: GeoScope | null; cityId: string | null }): ArticleScopeClassification {
  if (article.geoScope === "COUNTRY") return { scope: "GLOBAL" };
  if (article.geoScope === "CITY" && article.cityId) return { scope: "CITY", cityId: article.cityId };
  return { scope: "UNKNOWN" };
}
