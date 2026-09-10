import { permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import {
  buildAbsoluteCanonicalUrl,
  buildCityPublicPath,
} from "@/lib/routing/cityPaths";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { listNationalBlogArticles } from "@/server/article/listCityHomeArticles";
import { BlogIndex } from "./BlogIndex";

const JOURNAL_FILTER_KEYS = new Set(["type", "category", "tag"]);

type BlogSearchParams = Record<string, string | string[] | undefined>;

function scalar(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(scalar(value) ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 1 ? parsed : 1;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<BlogSearchParams>;
}): Promise<Metadata> {
  const query = await searchParams;
  const page = parsePage(query.page);
  const isFiltered = Object.keys(query).some((key) => JOURNAL_FILTER_KEYS.has(key));
  const canonicalPath = !isFiltered && page > 1 ? `/blog?page=${page}` : "/blog";
  const baseTitle = "Журнал — mamaGo";

  return applyGlobalRobotsOverride({
    title: !isFiltered && page > 1 ? `${baseTitle} — страница ${page}` : baseTitle,
    description: "Идеи для прогулок, маршруты и советы для семей с детьми",
    alternates: {
      canonical: buildAbsoluteCanonicalUrl(canonicalPath),
    },
    ...(isFiltered ? { robots: { index: false, follow: true } } : {}),
  });
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<BlogSearchParams>;
}) {
  const query = await searchParams;
  const citySlug = scalar(query.city);

  // Preserve legacy/query-based links while keeping /{city}/blog as the only
  // canonical city-scoped journal listing.
  if (citySlug) {
    permanentRedirect(
      buildCityPublicPath({
        citySlug,
        type: "journal",
      }),
    );
  }

  const articles = await listNationalBlogArticles();

  return (
    <main>
      <BlogIndex articles={articles} />
    </main>
  );
}
