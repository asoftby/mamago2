import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { buildOgMeta } from "@/lib/seo/buildOgMeta";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import { buildArticlePublicPath, buildCityPublicPath } from "@/lib/routing/cityPaths";
import { getCityDisplayName } from "@/lib/city/cityDisplayNames";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";
import { buildArticleCityDiscoveryWhere } from "@/lib/article/articleGeographyTargets";

type PageProps = {
  params: Promise<{ city: string; tagSlug: string }>;
};

async function resolveCity(citySlug: string) {
  return findCityBySlug(citySlug.toLowerCase(), {
    isActive: true,
    select: { id: true, slug: true, name: true, regionId: true },
  });
}

async function loadTagPageData(citySlug: string, tagSlug: string) {
  const city = await resolveCity(citySlug);
  if (!city) return null;

  const tag = await prisma.discoveryTag.findFirst({
    where: { slug: tagSlug, isActive: true },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
    },
  });
  if (!tag) return null;

  const articles = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      tags: { some: { id: tag.id } },
      ...buildArticleCityDiscoveryWhere(city, true),
    },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    take: 60,
    select: {
      id: true,
      title: true,
      slug: true,
      subtitle: true,
      excerpt: true,
      publishedAt: true,
      heroImage: true,
      seoOgImage: true,
      geoScope: true,
      city: { select: { slug: true } },
      category: { select: { nameRu: true } },
    },
  });

  return {
    city,
    tag,
    articles: articles
      .filter((article) => Boolean(article.slug))
      .map((article) => ({
        id: article.id,
        title: article.title,
        slug: article.slug as string,
        subtitle: article.subtitle,
        excerpt: article.excerpt,
        publishedAt: article.publishedAt,
        heroUrl: article.heroImage ?? article.seoOgImage ?? null,
        categoryLabel:
          article.subtitle === BREAKING_NEWS_SUBTITLE
            ? "Breaking news"
            : article.category?.nameRu ?? "Журнал",
        href: buildArticlePublicPath({
          slug: article.slug as string,
          geoScope: article.geoScope,
          citySlug: article.city?.slug ?? undefined,
        }),
      })),
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: citySlug, tagSlug } = await params;
  const data = await loadTagPageData(citySlug, tagSlug);
  if (!data) return {};

  const canonical = `${getCanonicalPublicAppUrl()}${buildCityPublicPath({
    citySlug: data.city.slug,
    type: "tag",
    slug: data.tag.slug,
  })}`;
  const cityName = getCityDisplayName(data.city.slug);
  const title = data.tag.seoTitle?.trim() || `${data.tag.title} в ${cityName} — mamaGo`;
  const description =
    data.tag.seoDescription?.trim() ||
    data.tag.description?.trim() ||
    `Публикации по теме «${data.tag.title}» в ${cityName}.`;

  return applyGlobalRobotsOverride({
    ...buildOgMeta({
      title,
      description,
      url: canonical,
      robots: { index: true, follow: true },
    }),
    title,
    description,
    alternates: { canonical },
  });
}

export default async function CityTagPage({ params }: PageProps) {
  const { city: citySlug, tagSlug } = await params;
  const data = await loadTagPageData(citySlug, tagSlug);
  if (!data) notFound();

  const cityName = getCityDisplayName(data.city.slug);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 md:py-14">
      <div className="mb-8">
        <p className="mb-2 text-sm font-medium text-primary">
          <Link href={`/${data.city.slug}`} className="hover:underline">
            {data.city.name}
          </Link>
          <span className="mx-2 text-muted-foreground">/</span>
          <span className="text-muted-foreground">Теги</span>
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {data.tag.title}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          {data.tag.description?.trim() || `Публикации по теме «${data.tag.title}» в ${cityName}.`}
        </p>
      </div>

      {data.articles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-sm text-muted-foreground">
          Для этого тега пока нет опубликованных материалов в контексте города {data.city.name}.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.articles.map((article) => (
            <Link
              key={article.id}
              href={article.href}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors hover:border-primary/30 hover:bg-slate-50"
            >
              {article.heroUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={article.heroUrl}
                  alt={article.title}
                  className="h-52 w-full object-cover"
                />
              ) : (
                <div className="h-52 w-full bg-slate-100" />
              )}
              <div className="space-y-3 p-5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
                  <span>{article.categoryLabel}</span>
                  {article.publishedAt ? (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="text-muted-foreground normal-case tracking-normal">
                        {new Intl.DateTimeFormat("ru-RU", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }).format(article.publishedAt)}
                      </span>
                    </>
                  ) : null}
                </div>
                <h2 className="text-xl font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
                  {article.title}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {article.subtitle && article.subtitle !== BREAKING_NEWS_SUBTITLE
                    ? article.subtitle
                    : article.excerpt || "Открыть публикацию"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
