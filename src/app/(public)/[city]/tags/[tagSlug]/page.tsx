import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { buildOgMeta } from "@/lib/seo/buildOgMeta";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import { buildCityPublicPath } from "@/lib/routing/cityPaths";
import { getCityDisplayName } from "@/lib/city/cityDisplayNames";
import { shouldIndexTagPage } from "@/lib/seo/discoveryTagIndexing";
import { JournalTagCardList } from "@/components/journal/JournalTagCardList";
import { queryCityHomeArticles } from "@/server/article/listCityHomeArticles";
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

function indexableTaggedArticleWhere(tagId: string): Prisma.ArticleWhereInput {
  return {
    ...getPublicPublishedArticleWhere(),
    noindex: false,
    slug: { not: null },
    publishedAt: { not: null },
    OR: [
      { seoRobots: null },
      { NOT: { seoRobots: { contains: "noindex", mode: "insensitive" } } },
    ],
    tags: { some: { id: tagId } },
  };
}

/** Only local or broadly applicable articles count towards the city's SEO threshold. */
function cityRelevantArticleWhere(city: CityRef): Prisma.ArticleWhereInput {
  const targets: Prisma.ArticleGeographyTargetWhereInput[] = [
    { type: "CITY", cityId: city.id },
    ...(city.regionId ? [{ type: "REGION" as const, regionId: city.regionId }] : []),
  ];
  return {
    OR: [
      { geoScope: "COUNTRY" },
      { geoScope: "CITY", cityId: city.id },
      ...(city.regionId ? [{ geoScope: "REGION" as const, regionId: city.regionId }] : []),
      { additionalGeographyTargets: { some: { OR: targets } } },
    ],
  };
}

async function loadTagPageData(citySlug: string, tagSlug: string, page: number) {
  const city = await resolveCity(citySlug);
  if (!city) return null;

  const tag = await prisma.discoveryTag.findFirst({
    where: { slug: tagSlug, isActive: true, reviewStatus: "APPROVED" },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
      indexingMode: true,
    },
  });
  if (!tag) return null;

  const where = indexableTaggedArticleWhere(tag.id);
  const [total, eligibleCityCount] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.count({ where: { AND: [where, cityRelevantArticleWhere(city)] } }),
  ]);
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.max(1, Math.trunc(page));
  const articles = safePage > totalPages
    ? []
    : await queryCityHomeArticles(city, {
        skip: (safePage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        additionalWhere: where,
      });

  return {
    city,
    tag,
    page: safePage,
    total,
    totalPages,
    canIndex: shouldIndexTagPage(tag.indexingMode, eligibleCityCount),
    articles,
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
  const customSeoTitle = data.tag.seoTitle?.trim() || null;
  const fallbackTitleBase = `${data.tag.title} в ${cityName}`;
  const title = customSeoTitle
    ? requestedPage > 1
      ? `${customSeoTitle} — страница ${requestedPage}`
      : customSeoTitle
    : requestedPage > 1
      ? `${fallbackTitleBase} — страница ${requestedPage} — mamaGo`
      : `${fallbackTitleBase} — mamaGo`;
  const description =
    data.tag.seoDescription?.trim() ||
    data.tag.description?.trim() ||
    `Публикации по теме «${data.tag.title}» в ${cityName}.`;

  return applyGlobalRobotsOverride({
    ...buildOgMeta({
      title,
      description,
      url: canonical,
      robots: { index: data.canIndex, follow: true },
    }),
    title,
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
    <main className="site-wrap px-4 py-10 sm:px-7 md:py-14">
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

      <JournalTagCardList articles={data.articles} citySlug={data.city.slug} />

      <div className="-mx-4 mt-10 sm:-mx-6">
        <BlogPagination basePath={basePath} page={data.page} totalPages={data.totalPages} />
      </div>
    </main>
  );
}
