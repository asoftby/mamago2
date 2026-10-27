import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogPagination } from "../../../../blog/BlogPagination";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import {
  cityBlogCategoryScopeWhere,
  listCityBlogCategoryArticles,
  listCityBlogCategoryFacets,
  resolveCityBlogCategory,
} from "@/server/article/cityBlogCategories";
import { JournalPageView } from "@/components/journal/JournalPageView";
import { journalTypeFilterHref, parseJournalTypeFilter } from "@/lib/journal/journalCardMeta";
import { loadJournalPage } from "@/server/journal/journalPage";
import { getCityDisplayName } from "@/lib/city/cityDisplayNames";
import { buildAbsoluteCanonicalUrl, buildCityPublicPath } from "@/lib/routing/cityPaths";
import { buildPublicPath } from "@/lib/routing/surface";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ city: string; category: string }>;
  searchParams: Promise<{ page?: string | string[]; tag?: string | string[]; type?: string | string[] }>;
};

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

function categoryPath(citySlug: string, categorySlug: string) {
  return buildPublicPath(`${buildCityPublicPath({ citySlug, type: "journal" })}/category/${categorySlug}`);
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ city: citySlug, category: categorySlug }, query] = await Promise.all([params, searchParams]);
  const city = await resolveCity(citySlug);
  if (!city) return applyGlobalRobotsOverride({ robots: { index: false, follow: true } });

  const category = await resolveCityBlogCategory(city, categorySlug);
  if (!category) return applyGlobalRobotsOverride({ robots: { index: false, follow: true } });

  const page = parsePage(query.page);
  const result = await listCityBlogCategoryArticles(city, category.id, page);
  const cityName = getCityDisplayName(city.slug);
  const basePath = categoryPath(city.slug, category.slug);
  const canonical = buildAbsoluteCanonicalUrl(page > 1 ? `${basePath}?page=${page}` : basePath);
  const titleBase = category.journalSeoTitle?.trim() || `${category.nameRu} для семей в ${cityName}`;

  return applyGlobalRobotsOverride({
    title: page > 1 ? `${titleBase} — страница ${page} — mamaGo` : `${titleBase} — mamaGo`,
    description: category.journalSeoDescription?.trim() || `Статьи, обзоры и полезные материалы mamaGo в разделе «${category.nameRu}» для семей с детьми в ${cityName}.`,
    alternates: { canonical },
    ...(result.total === 0 ? { robots: { index: false, follow: true } } : {}),
  });
}

export default async function CityBlogCategoryPage({ params, searchParams }: PageProps) {
  const [{ city: citySlug, category: categorySlug }, query] = await Promise.all([params, searchParams]);
  const city = await resolveCity(citySlug);
  if (!city) notFound();

  const category = await resolveCityBlogCategory(city, categorySlug);
  if (!category) notFound();

  const requestedPage = parsePage(query.page);
  const rawTag = Array.isArray(query.tag) ? query.tag[0] : query.tag;
  const facets = await listCityBlogCategoryFacets(city, category);
  // Неизвестный slug темы игнорируем — показываем весь раздел.
  const activeTag = facets.tags.find((tag) => tag.slug === rawTag) ?? null;
  const typeFilter = parseJournalTypeFilter(query.type);
  // Рубрика фильтрует все блоки страницы (Главное, Новости, Подборки, лента).
  const scopeWhere = await cityBlogCategoryScopeWhere(city, category.id, { tagSlug: activeTag?.slug ?? null });
  const journal = await loadJournalPage({
    city,
    scopeWhere,
    scopeKey: `category:${category.id}:${activeTag?.slug ?? ""}`,
    typeFilter,
    page: requestedPage,
  });
  if (requestedPage > journal.totalPages && journal.total > 0) notFound();

  const cityName = getCityDisplayName(city.slug);
  const categoryBasePath = categoryPath(city.slug, category.slug);
  const basePath = activeTag ? `${categoryBasePath}?tag=${encodeURIComponent(activeTag.slug)}` : categoryBasePath;
  const chipBase = "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm transition-colors";
  const chipIdle = "border-border hover:border-foreground/40";
  const chipActive = "border-foreground bg-foreground font-semibold text-background";

  const breadcrumbsJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: city.name, item: buildAbsoluteCanonicalUrl(buildCityPublicPath({ citySlug: city.slug, type: "hub" })) },
      { "@type": "ListItem", position: 2, name: "Журнал", item: buildAbsoluteCanonicalUrl(buildCityPublicPath({ citySlug: city.slug, type: "journal" })) },
      { "@type": "ListItem", position: 3, name: category.nameRu, item: buildAbsoluteCanonicalUrl(categoryPath(city.slug, category.slug)) },
    ],
  }).replace(/</g, "\\u003c");

  const facetsNav = facets.subcategories.length > 0 || facets.tags.length > 0 ? (
    <div className="space-y-3 pt-2">
      {facets.subcategories.length > 0 ? (
        <nav className="no-scrollbar flex gap-2 overflow-x-auto pb-1" aria-label="Подкатегории">
          <Link
            href={categoryPath(city.slug, facets.root.slug)}
            aria-current={!category.parentId ? "page" : undefined}
            className={`${chipBase} ${!category.parentId ? chipActive : chipIdle}`}
          >
            Все {facets.root.name.toLowerCase()}
          </Link>
          {facets.subcategories.map((item) => (
            <Link
              key={item.id}
              href={categoryPath(city.slug, item.slug)}
              aria-current={item.id === category.id ? "page" : undefined}
              className={`${chipBase} ${item.id === category.id ? chipActive : chipIdle}`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      ) : null}
      {facets.tags.length > 0 ? (
        <nav className="no-scrollbar flex gap-2 overflow-x-auto pb-1" aria-label="Темы раздела">
          <Link
            href={categoryBasePath}
            aria-current={!activeTag ? "page" : undefined}
            className={`${chipBase} ${!activeTag ? "border-primary bg-primary/10 font-semibold text-brand-ink" : chipIdle}`}
          >
            Все темы
          </Link>
          {facets.tags.map((tag) => (
            <Link
              key={tag.id}
              href={`${categoryBasePath}?tag=${encodeURIComponent(tag.slug)}`}
              aria-current={activeTag?.slug === tag.slug ? "page" : undefined}
              className={`${chipBase} ${activeTag?.slug === tag.slug ? "border-primary bg-primary/10 font-semibold text-brand-ink" : chipIdle}`}
            >
              {tag.name}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  ) : null;

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbsJsonLd }} />
      <JournalPageView
        title={category.nameRu}
        subtitle={category.journalIntro?.trim() || `Статьи, обзоры и полезные материалы для семей с детьми в ${cityName}.`}
        main={journal.main}
        news={journal.news}
        collections={journal.collections}
        feed={journal.feed}
        typeFilter={typeFilter}
        basePath={basePath}
        citySlug={city.slug}
        intro={facetsNav}
      />
      <BlogPagination
        basePath={typeFilter ? journalTypeFilterHref(basePath, typeFilter) : basePath}
        page={journal.page}
        totalPages={journal.totalPages}
      />
    </main>
  );
}
