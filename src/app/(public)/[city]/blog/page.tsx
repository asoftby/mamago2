import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogPagination } from "../../blog/BlogPagination";
import { JournalPageView } from "@/components/journal/JournalPageView";
import { getCityDisplayName } from "@/lib/city/cityDisplayNames";
import { journalTypeFilterHref, parseJournalTypeFilter } from "@/lib/journal/journalCardMeta";
import {
  buildAbsoluteCanonicalUrl,
  buildCityPublicPath,
} from "@/lib/routing/cityPaths";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { loadJournalPage } from "@/server/journal/journalPage";
import { findCityBySlug } from "@/server/geo/findCityBySlug";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ page?: string | string[]; type?: string | string[]; archive?: string | string[] }>;
}

async function resolveCity(citySlug: string) {
  return findCityBySlug(citySlug.toLowerCase(), {
    isActive: true,
    select: { id: true, slug: true, name: true, regionId: true },
  });
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ city: cityParam }, query] = await Promise.all([params, searchParams]);
  const city = await resolveCity(cityParam);

  if (!city) return {};

  const page = parsePage(query.page);
  const cityName = getCityDisplayName(city.slug);
  const canonicalPath = buildCityPublicPath({
    citySlug: city.slug,
    type: "journal",
  });
  const canonical = buildAbsoluteCanonicalUrl(
    page > 1 ? `${canonicalPath}?page=${page}` : canonicalPath,
  );

  return applyGlobalRobotsOverride({
    title:
      page > 1
        ? `Журнал для семей в ${cityName} — страница ${page} — mamaGo`
        : `Журнал для семей в ${cityName} — mamaGo`,
    description: `Идеи для прогулок, маршруты и советы для семей с детьми в ${cityName}`,
    alternates: { canonical },
  });
}

export default async function CityBlogPage({ params, searchParams }: PageProps) {
  const [{ city: cityParam }, query] = await Promise.all([params, searchParams]);
  const city = await resolveCity(cityParam);

  if (!city) notFound();

  const requestedPage = parsePage(query.page);
  const typeFilter = parseJournalTypeFilter(query.type);
  const newsArchive = typeFilter === "BREAKING_NEWS" && (Array.isArray(query.archive) ? query.archive[0] : query.archive) === "1";
  // Территория — только из глобальной шапки (город страницы): материалы города выше.
  const journal = await loadJournalPage({
    city,
    scopeWhere: null,
    scopeKey: "all",
    typeFilter,
    newsArchive,
    page: requestedPage,
  });
  if (requestedPage > journal.totalPages && journal.total > 0) notFound();

  const basePath = buildCityPublicPath({ citySlug: city.slug, type: "journal" });

  return (
    <main>
      <JournalPageView
        title="Журнал"
        subtitle="Вдохновение для семейных прогулок, событий и открытий."
        main={journal.main}
        news={journal.news}
        collections={journal.collections}
        feed={journal.feed}
        typeFilter={typeFilter}
        newsArchive={newsArchive}
        basePath={basePath}
        citySlug={city.slug}
      />
      <BlogPagination
        basePath={typeFilter ? `${journalTypeFilterHref(basePath, typeFilter)}${newsArchive ? "&archive=1" : ""}` : basePath}
        page={journal.page}
        totalPages={journal.totalPages}
      />
    </main>
  );
}
