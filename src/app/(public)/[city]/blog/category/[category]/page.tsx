import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogPagination } from "../../../../blog/BlogPagination";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import {
  listCityBlogCategoryArticles,
  listCityBlogCategoryFacets,
  listPopulatedCityBlogCategories,
  resolveCityBlogCategory,
} from "@/server/article/cityBlogCategories";
import { getCityDisplayName } from "@/lib/city/cityDisplayNames";
import { buildAbsoluteCanonicalUrl } from "@/lib/routing/cityPaths";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ city: string; category: string }>;
  searchParams: Promise<{ page?: string | string[]; tag?: string | string[] }>;
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
  return `/${citySlug}/blog/category/${categorySlug}`;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ city: citySlug, category: categorySlug }, query] = await Promise.all([params, searchParams]);
  const city = await resolveCity(citySlug);
  if (!city) return applyGlobalRobotsOverride({ robots: { index: false, follow: true } });

  const category = await resolveCityBlogCategory(city, categorySlug);
  if (!category) return applyGlobalRobotsOverride({ robots: { index: false, follow: true } });

  const page = parsePage(query.page);
  const cityName = getCityDisplayName(city.slug);
  const basePath = categoryPath(city.slug, category.slug);
  const canonical = buildAbsoluteCanonicalUrl(page > 1 ? `${basePath}?page=${page}` : basePath);
  const titleBase = `${category.nameRu} для семей в ${cityName}`;

  return applyGlobalRobotsOverride({
    title: page > 1 ? `${titleBase} — страница ${page} — mamaGo` : `${titleBase} — mamaGo`,
    description: `Статьи, обзоры и полезные материалы mamaGo в разделе «${category.nameRu}» для семей с детьми в ${cityName}.`,
    alternates: { canonical },
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
  const [journal, categories] = await Promise.all([
    listCityBlogCategoryArticles(city, category.id, requestedPage, undefined, { tagSlug: activeTag?.slug ?? null }),
    listPopulatedCityBlogCategories(city),
  ]);
  if (requestedPage > journal.totalPages && journal.total > 0) notFound();

  const cityName = getCityDisplayName(city.slug);
  const categoryBasePath = categoryPath(city.slug, category.slug);
  const basePath = activeTag ? `${categoryBasePath}?tag=${encodeURIComponent(activeTag.slug)}` : categoryBasePath;
  const chipBase = "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors";
  const chipIdle = "border-border hover:border-foreground/40";
  const chipActive = "border-foreground bg-foreground font-semibold text-background";

  return (
    <main className="site-wrap px-6 py-10 sm:px-7 md:py-14">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground" aria-label="Хлебные крошки">
        <Link href={`/${city.slug}`} className="hover:text-foreground hover:underline">{city.name}</Link>
        <span>/</span>
        <Link href={`/${city.slug}/blog`} className="hover:text-foreground hover:underline">Журнал</Link>
        <span>/</span>
        <span className="text-foreground">{category.nameRu}</span>
      </nav>

      <header className="mb-8 border-b border-border pb-8">
        <p className="mb-3 text-[11px] font-mono uppercase tracking-[.14em] text-primary">Раздел журнала</p>
        <h1 className="font-serif text-4xl leading-tight tracking-[-.025em] md:text-6xl">{category.nameRu}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
          Статьи, обзоры и полезные материалы для семей с детьми в {cityName}.
        </p>
      </header>

      {categories.length > 1 ? (
        <nav className="no-scrollbar mb-8 flex gap-2 overflow-x-auto pb-2" aria-label="Другие разделы журнала">
          {categories.map((item) => (
            <Link
              key={item.id}
              href={categoryPath(city.slug, item.slug)}
              aria-current={item.id === category.id ? "page" : undefined}
              className={
                item.id === category.id
                  ? "shrink-0 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
                  : "shrink-0 rounded-full border border-border px-4 py-2 text-sm hover:border-foreground/40"
              }
            >
              {item.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {facets.subcategories.length > 0 ? (
        <nav className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Подкатегории">
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
        <nav className="no-scrollbar mb-8 flex gap-2 overflow-x-auto pb-1" aria-label="Темы раздела">
          <Link
            href={categoryBasePath}
            aria-current={!activeTag ? "page" : undefined}
            className={`${chipBase} ${!activeTag ? "border-primary bg-primary/10 font-semibold text-primary" : chipIdle}`}
          >
            Все темы
          </Link>
          {facets.tags.map((tag) => (
            <Link
              key={tag.id}
              href={`${categoryBasePath}?tag=${encodeURIComponent(tag.slug)}`}
              aria-current={activeTag?.slug === tag.slug ? "page" : undefined}
              className={`${chipBase} ${activeTag?.slug === tag.slug ? "border-primary bg-primary/10 font-semibold text-primary" : chipIdle}`}
            >
              {tag.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <section aria-label={`Материалы раздела ${category.nameRu}`}>
        <div className="grid gap-6 md:grid-cols-2">
          {journal.articles.map((article) => (
            <article key={article.id} className="overflow-hidden rounded-2xl border border-border bg-background">
              <Link href={article.href} className="group block h-full">
                {article.coverImageUrl ? (
                  <img src={article.coverImageUrl} alt="" className="aspect-[16/10] w-full object-cover" loading="lazy" />
                ) : (
                  <div className="aspect-[16/10] w-full bg-muted" />
                )}
                <div className="p-5">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {article.publishedAt ? <time dateTime={new Date(article.publishedAt).toISOString()}>{new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(article.publishedAt))}</time> : null}
                    <span>·</span>
                    <span>{article.readTime} мин</span>
                  </div>
                  <h2 className="font-serif text-2xl leading-tight tracking-[-.015em] transition-colors group-hover:text-primary">{article.title}</h2>
                  {article.subtitle ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{article.subtitle}</p> : null}
                </div>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <BlogPagination basePath={basePath} page={journal.page} totalPages={journal.totalPages} />
    </main>
  );
}
