import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleCategoryHubView } from "@/components/article/ArticleCategoryHub";
import { getCityDisplayName } from "@/lib/city/cityDisplayNames";
import { articleCategoryHubUrl } from "@/lib/seo/articleCategoryHub";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { loadArticleCategoryHubPage } from "@/server/article/articleCategoryHub";

interface PageProps {
  params: Promise<{ city: string; category: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

async function resolveCity(slug: string) {
  return findCityBySlug(slug.toLowerCase(), {
    isActive: true,
    select: { id: true, slug: true, name: true, regionId: true },
  });
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ city: citySlug, category: categorySlug }, query] = await Promise.all([params, searchParams]);
  const city = await resolveCity(citySlug);
  if (!city) return applyGlobalRobotsOverride({ robots: { index: false, follow: true } });

  const page = parsePage(query.page);
  const data = await loadArticleCategoryHubPage({ categorySlug, city, page });
  if (!data) return applyGlobalRobotsOverride({ robots: { index: false, follow: true } });

  const cityName = getCityDisplayName(city.slug);
  const titleBase = `${data.category.name} в ${cityName}`;
  const description = `${data.category.name} в ${cityName}: обзоры, подборки и полезные материалы для семей с детьми на mamaGo.`;
  const canonical = articleCategoryHubUrl({
    categorySlug: data.category.slug,
    citySlug: city.slug,
    page,
  });

  return applyGlobalRobotsOverride({
    title: page > 1 ? `${titleBase} — страница ${page} — mamaGo` : `${titleBase} — mamaGo`,
    description,
    alternates: { canonical },
    robots: data.total > 0 ? { index: true, follow: true } : { index: false, follow: true },
  });
}

export default async function CityArticleCategoryPage({ params, searchParams }: PageProps) {
  const [{ city: citySlug, category: categorySlug }, query] = await Promise.all([params, searchParams]);
  const city = await resolveCity(citySlug);
  if (!city) notFound();

  const page = parsePage(query.page);
  const data = await loadArticleCategoryHubPage({ categorySlug, city, page });
  if (!data) notFound();
  if (page > data.totalPages && data.total > 0) notFound();

  const cityName = getCityDisplayName(city.slug);
  const heading = `${data.category.name} в ${cityName}`;
  const description = `${data.category.name} в ${cityName}: обзоры, подборки и полезные материалы для семей с детьми.`;

  return (
    <ArticleCategoryHubView
      categorySlug={data.category.slug}
      categoryName={heading}
      description={description}
      articles={data.articles}
      page={data.page}
      totalPages={data.totalPages}
      citySlug={city.slug}
    />
  );
}
