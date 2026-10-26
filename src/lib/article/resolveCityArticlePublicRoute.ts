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
 * Resolves local slugs first, then published national or uniquely matched
 * cross-city slugs with a permanent canonical redirect (never a 404 caused
 * solely by the reader\u0027s selected city).
 */
export async function resolveCityArticlePublicRoute(
  slug: string,
  city: { id: string; slug: string },
): Promise<CityArticlePublicRouteResolution> {
  const resolved = await findArticleBySlug(slug, city.id);
  if (!resolved) {
    // A user can arrive with their selected city in an otherwise valid URL.
    // First prefer the unambiguous national article (REGION/COUNTRY).
    const national = await findArticleBySlug(slug, null);
    if (national) {
      const article = await prisma.article.findFirst({
        where: { id: national.articleId, ...getPublicPublishedArticleWhere() },
        select: { slug: true },
      });
      if (article?.slug) {
        return { kind: "national_redirect", path: buildNationalArticlePath(article.slug) };
      }
    }

    // CITY slugs are only unique *within a city*. Redirect across cities
    // only when the current slug resolves to exactly one published article.
    // Never guess between two different cities with the same slug.
    const candidates = await prisma.article.findMany({
      where: {
        ...getPublicPublishedArticleWhere(),
        geoScope: "CITY",
        cityId: { not: city.id },
        slug,
      },
      take: 2,
      select: { slug: true, city: { select: { slug: true } } },
    });
    if (candidates.length === 1 && candidates[0].city?.slug) {
      return {
        kind: "canonical_redirect",
        path: buildCityPublicPath({
          citySlug: candidates[0].city.slug,
          type: "article",
          slug: candidates[0].slug!,
        }),
      };
    }
    if (candidates.length > 1) return { kind: "not_found" };

    const history = await prisma.articleSlugHistory.findMany({
      where: {
        slug,
        article: {
          ...getPublicPublishedArticleWhere(),
          geoScope: "CITY",
          cityId: { not: city.id },
        },
      },
      take: 2,
      select: {
        articleId: true,
        article: { select: { slug: true, city: { select: { slug: true } } } },
      },
    });
    const uniqueArticles = [...new Map(history.map(row => [row.articleId, row.article])).values()];
    if (uniqueArticles.length === 1 && uniqueArticles[0].slug && uniqueArticles[0].city?.slug) {
      return {
        kind: "canonical_redirect",
        path: buildCityPublicPath({
          citySlug: uniqueArticles[0].city.slug,
          type: "article",
          slug: uniqueArticles[0].slug,
        }),
      };
    }
    return { kind: "not_found" };
  }

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
