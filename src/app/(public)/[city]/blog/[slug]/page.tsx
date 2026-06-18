/**
 * /{city}/blog/[slug] — CITY-scope article page.
 *
 * Reads only articles where geoScope === CITY and cityId matches the city.
 * Redirects COUNTRY-scope articles to /blog/{slug}.
 * Redirects to current slug if a slug-history redirect is needed.
 */
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import {
  buildCityPublicPath,
  buildNationalArticlePath,
} from "@/lib/routing/cityPaths";
import { notFound, permanentRedirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { loadArticleMvpBySlugPublic, loadRelatedBreakingNews } from "@/lib/article/articleMvpRenderData";
import { buildOgMeta } from "@/lib/seo/buildOgMeta";
import { AnalyticsDetailBeacon } from "@/components/analytics/AnalyticsDetailBeacon";
import { ArticleMvpView } from "@/components/article/mvp/ArticleMvpView";
import { BreakingNewsView } from "@/components/article/mvp/BreakingNewsView";
import { JsonLd } from "@/components/seo/JsonLd";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";
import {
  incrementPublishedArticleViews,
  shouldCountPublishedArticleViewRequest,
} from "@/lib/article/articleViews";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { buildArticleJsonLd } from "@/lib/seo/schema/buildArticleJsonLd";
import { buildBreadcrumbJsonLd } from "@/lib/seo/schema/buildBreadcrumbJsonLd";

interface PageProps {
  params: Promise<{ city: string; slug: string }>;
}

export const dynamic = "force-dynamic";

async function resolveCity(citySlug: string) {
  return findCityBySlug(citySlug.toLowerCase(), {
    isActive: true,
    select: { id: true, slug: true, name: true },
  });
}

export async function generateMetadata({ params }: PageProps) {
  const { city: cityParam, slug } = await params;
  const city = await resolveCity(cityParam);
  if (!city) return {};

  const publicBase = getCanonicalPublicAppUrl();
  const defaultCanonical = `${publicBase}${buildCityPublicPath({
    citySlug: city.slug,
    type: "article",
    slug,
  })}`;

  const mvp = await loadArticleMvpBySlugPublic(slug, city.id);
  if (!mvp) return {};

  const article = await prisma.article.findUnique({
    where: { id: mvp.id },
    select: {
      geoScope: true,
      city: { select: { slug: true } },
      seoTitle: true,
      seoDescription: true,
      seoCanonicalUrl: true,
      seoOgTitle: true,
      seoOgDescription: true,
      seoOgImage: true,
      seoRobots: true,
      noindex: true,
    },
  });
  if (!article) return {};

  // If geoScope is COUNTRY, redirect to national URL
  if (article.geoScope === "COUNTRY") {
    permanentRedirect(buildNationalArticlePath(mvp.slug ?? slug));
  }

  const title = article.seoTitle?.trim() || `${mvp.title} — mamaGo`;
  const description = article.seoDescription?.trim() || mvp.excerpt?.trim() || undefined;
  const canonical = article.seoCanonicalUrl?.trim() || defaultCanonical;
  const noindex =
    article.noindex === true ||
    (article.seoRobots?.toLowerCase().includes("noindex") ?? false);

  return applyGlobalRobotsOverride({
    ...buildOgMeta({
      title: article.seoOgTitle?.trim() || title,
      description: article.seoOgDescription?.trim() || description,
      image: article.seoOgImage?.trim() || mvp.heroUrl,
      url: canonical,
      robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
    }),
    title,
    description,
    alternates: { canonical },
  });
}

export default async function CityArticlePage({ params }: PageProps) {
  const { city: cityParam, slug } = await params;

  const city = await resolveCity(cityParam);
  if (!city) notFound();

  const user = await getCurrentUser();
  const canEdit = user?.role === "ADMIN" || user?.role === "MODERATOR";

  const mvp = await loadArticleMvpBySlugPublic(slug, city.id);
  if (!mvp) notFound();

  // Verify this article is CITY-scoped for this city; if COUNTRY → redirect to /blog
  const articleRow = await prisma.article.findUnique({
    where: { id: mvp.id },
    select: {
      geoScope: true,
      slug: true,
      cityId: true,
      updatedAt: true,
      seoCanonicalUrl: true,
      seoJsonLdOverride: true,
    },
  });
  if (!articleRow) notFound();

  if (articleRow.geoScope === "COUNTRY") {
    permanentRedirect(buildNationalArticlePath(articleRow.slug ?? slug));
  }

  // If article belongs to a different city, 404 (slug collision is per-city)
  if (articleRow.cityId !== city.id) notFound();

  // Redirect to current slug if we came in via an old slug
  if (articleRow.slug && articleRow.slug !== slug) {
    permanentRedirect(
      buildCityPublicPath({
        citySlug: city.slug,
        type: "article",
        slug: articleRow.slug,
      }),
    );
  }

  if (await shouldCountPublishedArticleViewRequest()) {
    await incrementPublishedArticleViews(mvp.id);
  }

  const editHref = canEdit
    ? mvp.subtitle === BREAKING_NEWS_SUBTITLE
      ? `/admin/content/publications/new?type=news&id=${mvp.id}`
      : `/admin/content/articles/${mvp.id}/edit`
    : undefined;
  const publicBase = getCanonicalPublicAppUrl();
  const canonicalPath = buildCityPublicPath({
    citySlug: city.slug,
    type: "article",
    slug: articleRow.slug ?? slug,
  });
  const schemaJsonLd =
    articleRow.seoJsonLdOverride && typeof articleRow.seoJsonLdOverride === "object"
      ? (articleRow.seoJsonLdOverride as Record<string, unknown>)
      : buildArticleJsonLd({
          canonicalUrl: articleRow.seoCanonicalUrl?.trim() || `${publicBase}${canonicalPath}`,
          headline: mvp.title,
          description: mvp.excerpt,
          image: mvp.heroUrl,
          datePublished: mvp.publishedAt,
          dateModified: articleRow.updatedAt,
          authorName: mvp.author?.displayName,
          publisherName: "mamaGo",
          articleSection: mvp.categoryLabel,
          keywords: mvp.tags.map((tag) => tag.title),
          isNews: mvp.subtitle === BREAKING_NEWS_SUBTITLE,
          publicBaseUrl: publicBase,
        });
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(
    [
      { name: "Главная", path: "/" },
      { name: city.name, path: `/${city.slug}` },
      { name: mvp.title, path: canonicalPath },
    ],
    publicBase,
  );

  if (mvp.subtitle === BREAKING_NEWS_SUBTITLE) {
    const related = await loadRelatedBreakingNews(mvp.id);
    return (
      <>
        <AnalyticsDetailBeacon entityType="ARTICLE" entityId={mvp.id} vertical="CITY" />
        <JsonLd
          data={[schemaJsonLd, breadcrumbJsonLd].filter(
            (item): item is Record<string, unknown> => Boolean(item),
          )}
        />
        <BreakingNewsView
          articleId={mvp.id}
          title={mvp.title}
          excerpt={mvp.excerpt}
          publishedAt={mvp.publishedAt}
          blocks={mvp.blocks}
          author={mvp.author}
          tags={mvp.tags}
          related={related}
          editHref={editHref}
          citySlug={city.slug}
        />
      </>
    );
  }

  return (
    <>
      <AnalyticsDetailBeacon entityType="ARTICLE" entityId={mvp.id} vertical="CITY" />
      <JsonLd
        data={[schemaJsonLd, breadcrumbJsonLd].filter(
          (item): item is Record<string, unknown> => Boolean(item),
        )}
      />
      <ArticleMvpView
        title={mvp.title}
        subtitle={mvp.subtitle}
        excerpt={mvp.excerpt}
        publishedAt={mvp.publishedAt}
        blocks={mvp.blocks}
        tags={mvp.tags}
        categoryLabel={mvp.categoryLabel}
        editHref={editHref}
        citySlug={city.slug}
      />
    </>
  );
}
