import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { buildOgMeta } from "@/lib/seo/buildOgMeta";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import { buildArticlePublicPath, buildCityPublicPath } from "@/lib/routing/cityPaths";
import { getCityDisplayName } from "@/lib/city/cityDisplayNames";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";
import { buildArticleCityDiscoveryWhere } from "@/lib/article/articleGeographyTargets";
import { getPublicPublishedArticleWhere } from "@/server/public/publicContentVisibility";
import { BlogPagination } from "../../../blog/BlogPagination";

type PageProps = {
  params: Promise<{ city: string; tagSlug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

type CityRef = {
  id: string;
  slug: string;
  name: string;
  regionId: string | null;
};

const PAGE_SIZE = 24;

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

async function resolveCity(citySlug: string) {
  return findCityBySlug(citySlug.toLowerCase(), {
    isActive: true,
    select: { id: true, slug: true, name: true, regionId: true },
  });
}

function indexableTaggedArticleWhere(city: CityRef, tagId: string): Prisma.ArticleWhereInput {
  return {
    ...getPublicPublishedArticleWhere(),
    noindex: false,
    slug: { not: null },
    publishedAt: { not: null },
    NOT: { seoRobots: { contains: "noindex", mode: "insensitive" } },
    tags: { some: { id: tagId } },
    ...buildArticleCityDiscoveryWhere(city, true),
  };
}

async function loadTagPageData(citySlug: string, tagSlug: string, page: number) {
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

  const where = indexableTaggedArticleWhere(city, tag.id);
  const total = await prisma.article.count({ where });
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.max(1, Math.trunc(page));
  const articles = safePage > totalPages
    ? []
    : await prisma.article.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
        skip: (safePage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
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
    page: safePage,
    total,
    totalPages,
    articles: articles.map((article) => ({
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

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ city: citySlug, tagSlug }, query] = await Promise.all([params, searchParams]);
  const requestedPage = parsePage(query.page);
  const data = await loadTagPageData(citySlug, tagSlug, requestedPage);
  if (!data || requestedPage > data.totalPages) {
    return applyGlobalRobotsOverride({ robots: { index: false, follow: true } });
  }

  const basePath = buildCityPublicPath({
    citySlug: data.city.slug,
    type: "tag",
    slug: data.tag.slug,
  });
  const canonical = `${getCanonicalPublicAppUrl()}${requestedPage > 1 ? `${basePath}?page=${requestedPage}` : basePath}`;
  const cityName = getCityDisplayName(data.city.slug);
  const titleBase = data.tag.seoTitle?.trim() || `${data.tag.title} в ${cityName}`;
  const description =
    data.tag.seoDescription?.trim() ||
    data.tag.description?.trim() ||
    `Публикации по теме «${data.tag.title}» в ${cityName}.`;

  return applyGlobalRobotsOverride({
    ...buildOgMeta({
      title: requestedPage > 1 ? `${titleBase} — страница ${requestedPage} — mamaGo` : `${titleBase} — mamaGo`,
      description,
      url: canonical,
      robots: { index: true, follow: true },
    }),
    title: requestedPage > 1 ? `${titleBase} — страница ${requestedPage} — mamaGo` : `${titleBase} — mamaGo`,
    description,
    alternates: { canonical },
  });
}

export default async function CityTagPage({ params, searchParams }: PageProps) {
  const [{ city: citySlug, tagSlug }, query] = await Promise.all([params, searchParams]);
  const requestedPage = parsePage(query.page);
  const data = await loadTagPageData(citySlug, tagSlug, requestedPage);
  if (!data || requestedPage > data.totalPages) notFound();

  const cityName = getCityDisplayName(data.city.slug);
  const basePath = buildCityPublicPath({
    citySlug: data.city.slug,
    type: "tag",
    slug: data.tag.slug,
  });

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
                loading="lazy"
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

      <div className="-mx-4 mt-10 sm:-mx-6">
        <BlogPagination basePath={basePath} page={data.page} totalPages={data.totalPages} />
      </div>
    </main>
  );
}
