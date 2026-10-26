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
 * Resolve /{city}/blog/{slug}, including links opened from another city.
 * Local slug ownership always wins; only an unambiguous published cross-city
 * match redirects to its true canonical URL. Drafts and ambiguous slugs stay 404.
 */
export async function resolveCityArticlePublicRoute(
  slug: string,
  city: { id: string; slug: string },
): Promise<CityArticlePublicRouteResolution> {
  const resolved = await findArticleBySlug(slug, city.id);
  if (!resolved) {
    // Bad or stale city context in a shared link must not make a published
    // article unreadable. Resolve an unambiguous slug across Belarus, while
    // preserving the canonical city/region/country URL (no duplicate pages).
    const matches = await prisma.article.findMany({
      where: { ...getPublicPublishedArticleWhere(), slug },
      select: { id: true, slug: true, geoScope: true, city: { select: { slug: true } } },
      take: 2,
    });

    if (matches.length === 1) {
      const match = matches[0];
      const path = match.geoScope === "CITY" && match.city?.slug
        ? buildCityPublicPath({ citySlug: match.city.slug, type: "article", slug: match.slug! })
        : buildNationalArticlePath(match.slug!);
      return { kind: match.geoScope === "CITY" ? "canonical_redirect" : "national_redirect", path };
    }
    if (matches.length > 1) return { kind: "not_found" };

    // A historical slug can likewise come from a link with the wrong city.
    const historicalMatches = await prisma.articleSlugHistory.findMany({
      where: { slug, article: getPublicPublishedArticleWhere() },
      distinct: ["articleId"],
      take: 2,
      select: { articleId: true },
    });
    if (historicalMatches.length !== 1) return { kind: "not_found" };

    const match = await prisma.article.findFirst({
      where: { id: historicalMatches[0].articleId, ...getPublicPublishedArticleWhere() },
      select: { slug: true, geoScope: true, city: { select: { slug: true } } },
    });
    if (!match?.slug) return { kind: "not_found" };
    if (match.geoScope === "CITY") {
      if (!match.city?.slug) return { kind: "not_found" };
      return {
        kind: "canonical_redirect",
        path: buildCityPublicPath({ citySlug: match.city.slug, type: "article", slug: match.slug }),
      };
    }
    return { kind: "national_redirect", path: buildNationalArticlePath(match.slug) };
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
