import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import {
  buildAbsoluteCanonicalUrl,
  buildCityPublicPath,
} from "@/lib/routing/cityPaths";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { listNationalBlogArticlesPage } from "@/server/article/listCityHomeArticles";
import { BlogIndex } from "./BlogIndex";
import { BlogPagination } from "./BlogPagination";

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ city?: string | string[]; page?: string | string[] }>;
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
  searchParams: Promise<{ city?: string | string[]; page?: string | string[] }>;
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
  const journal = await listNationalBlogArticlesPage(requestedPage);
  if (requestedPage > journal.totalPages && journal.total > 0) notFound();

  return (
    <main>
      <BlogIndex articles={journal.articles} />
      <BlogPagination basePath="/blog" page={journal.page} totalPages={journal.totalPages} />
    </main>
  );
}
