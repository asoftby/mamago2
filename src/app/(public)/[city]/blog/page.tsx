import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogIndex } from "../../blog/BlogIndex";
import { getCityDisplayName } from "@/lib/city/cityDisplayNames";
import {
  buildAbsoluteCanonicalUrl,
  buildCityPublicPath,
} from "@/lib/routing/cityPaths";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { listCityBlogArticles } from "@/server/article/listCityHomeArticles";
import { findCityBySlug } from "@/server/geo/findCityBySlug";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const JOURNAL_FILTER_KEYS = new Set(["type", "category", "tag"]);

function scalar(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(scalar(value) ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 1 ? parsed : 1;
}

async function resolveCity(citySlug: string) {
  return findCityBySlug(citySlug.toLowerCase(), {
    isActive: true,
    select: { id: true, slug: true, name: true, regionId: true },
  });
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ city: cityParam }, query] = await Promise.all([params, searchParams]);
  const city = await resolveCity(cityParam);

  if (!city) return {};

  const cityName = getCityDisplayName(city.slug);
  const canonicalPath = buildCityPublicPath({
    citySlug: city.slug,
    type: "journal",
  });
  const page = parsePage(query.page);
  const isFiltered = Object.keys(query).some((key) => JOURNAL_FILTER_KEYS.has(key));
  const canonical = buildAbsoluteCanonicalUrl(
    !isFiltered && page > 1 ? `${canonicalPath}?page=${page}` : canonicalPath,
  );
  const baseTitle = `Журнал для семей в ${cityName} — mamaGo`;

  return applyGlobalRobotsOverride({
    title: !isFiltered && page > 1 ? `${baseTitle} — страница ${page}` : baseTitle,
    description: `Идеи для прогулок, маршруты и советы для семей с детьми в ${cityName}`,
    alternates: { canonical },
    ...(isFiltered ? { robots: { index: false, follow: true } } : {}),
  });
}

export default async function CityBlogPage({ params }: PageProps) {
  const { city: cityParam } = await params;
  const city = await resolveCity(cityParam);

  if (!city) notFound();

  const articles = await listCityBlogArticles(city);

  return (
    <main>
      <BlogIndex articles={articles} />
    </main>
  );
}
