import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import {
  buildAbsoluteCanonicalUrl,
  buildCityPublicPath,
} from "@/lib/routing/cityPaths";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { JournalPageView } from "@/components/journal/JournalPageView";
import { journalTypeFilterHref, parseJournalTypeFilter } from "@/lib/journal/journalCardMeta";
import { loadJournalPage } from "@/server/journal/journalPage";
import { BlogPagination } from "./BlogPagination";

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

type BlogSearchParams = { city?: string | string[]; page?: string | string[]; type?: string | string[] };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<BlogSearchParams>;
}): Promise<Metadata> {
  const query = await searchParams;
  const page = parsePage(query.page);
  const canonicalPath = page > 1 ? `/blog?page=${page}` : "/blog";

  return applyGlobalRobotsOverride({
    title: page > 1 ? `Журнал — страница ${page} — mamaGo` : "Журнал — mamaGo",
    description: "Идеи для прогулок, маршруты и советы для семей с детьми",
    alternates: {
      canonical: buildAbsoluteCanonicalUrl(canonicalPath),
    },
  });
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<BlogSearchParams>;
}) {
  const query = await searchParams;
  const cityRaw = Array.isArray(query.city) ? query.city[0] : query.city;

  // Preserve legacy/query-based links while keeping /{city}/blog as the only
  // canonical city-scoped journal listing.
  if (cityRaw) {
    permanentRedirect(
      buildCityPublicPath({
        citySlug: cityRaw,
        type: "journal",
      }),
    );
  }

  const requestedPage = parsePage(query.page);
  const typeFilter = parseJournalTypeFilter(query.type);
  const journal = await loadJournalPage({
    city: null,
    scopeWhere: null,
    scopeKey: "all",
    typeFilter,
    page: requestedPage,
  });
  if (requestedPage > journal.totalPages && journal.total > 0) notFound();


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
        basePath="/blog"
      />
      <BlogPagination basePath={typeFilter ? journalTypeFilterHref("/blog", typeFilter) : "/blog"} page={journal.page} totalPages={journal.totalPages} />
    </main>
  );
}
