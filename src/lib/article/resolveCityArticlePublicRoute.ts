import prisma from "@/lib/prisma";
import {
  buildCityPublicPath,
  buildNationalArticlePath,
} from "@/lib/routing/cityPaths";
import { findArticleBySlug } from "@/lib/slug/articleSlugService";
import { getPublicPublishedArticleWhere } from "@/server/public/publicContentVisibility";

export type CityArticlePublicRouteResolution =
  | { kind: "not_found" }
  | { kind: "national_redirect"; path: string }
  | { kind: "canonical_redirect"; path: string }
  | {
      kind: "ok";
      articleId: string;
      canonicalSlug: string;
      requestedSlug: string;
      isHistoricalSlug: boolean;
    };

/**
 * Resolve a CITY-scoped public article route for /{city}/blog/{slug}.
 *
 * Uses the shared findArticleBySlug(slug, cityId) lookup so both the current
 * slug and ArticleSlugHistory entries resolve consistently.
 */
export async function resolveCityArticlePublicRoute(
  slug: string,
  city: { id: string; slug: string },
): Promise<CityArticlePublicRouteResolution> {
  const resolved = await findArticleBySlug(slug, city.id);
  if (!resolved) return { kind: "not_found" };

  const article = await prisma.article.findFirst({
    where: { id: resolved.articleId, ...getPublicPublishedArticleWhere() },
    select: {
      id: true,
      slug: true,
      geoScope: true,
      cityId: true,
      city: { select: { slug: true } },
    },
  });
  if (!article?.slug) return { kind: "not_found" };

  if (article.geoScope === "COUNTRY") {
    return { kind: "national_redirect", path: buildNationalArticlePath(article.slug) };
  }

  if (article.cityId !== city.id) {
    return { kind: "not_found" };
  }

  const canonicalSlug = article.slug;
  if (canonicalSlug !== slug) {
    return {
      kind: "canonical_redirect",
      path: buildCityPublicPath({
        citySlug: city.slug,
        type: "article",
        slug: canonicalSlug,
      }),
    };
  }

  return {
    kind: "ok",
    articleId: article.id,
    canonicalSlug,
    requestedSlug: slug,
    isHistoricalSlug: resolved.isRedirect,
  };
}
