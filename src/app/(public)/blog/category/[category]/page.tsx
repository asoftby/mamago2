import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleCategoryHubView } from "@/components/article/ArticleCategoryHub";
import { articleCategoryHubUrl } from "@/lib/seo/articleCategoryHub";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { loadArticleCategoryHubPage } from "@/server/article/articleCategoryHub";

interface PageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ category: categorySlug }, query] = await Promise.all([params, searchParams]);
  const page = parsePage(query.page);
  const data = await loadArticleCategoryHubPage({ categorySlug, page });
  if (!data) return applyGlobalRobotsOverride({ robots: { index: false, follow: true } });

  const titleBase = `${data.category.name} — журнал mamaGo`;
  const description = `${data.category.name}: обзоры, подборки и полезные материалы для семей с детьми на mamaGo.`;
  const canonical = articleCategoryHubUrl({ categorySlug: data.category.slug, page });

  return applyGlobalRobotsOverride({
    title: page > 1 ? `${titleBase} — страница ${page}` : titleBase,
    description,
    alternates: { canonical },
    robots: data.total > 0 ? { index: true, follow: true } : { index: false, follow: true },
  });
}

export default async function NationalArticleCategoryPage({ params, searchParams }: PageProps) {
  const [{ category: categorySlug }, query] = await Promise.all([params, searchParams]);
  const page = parsePage(query.page);
  const data = await loadArticleCategoryHubPage({ categorySlug, page });
  if (!data) notFound();
  if (page > data.totalPages && data.total > 0) notFound();

  return (
    <ArticleCategoryHubView
      categorySlug={data.category.slug}
      categoryName={data.category.name}
      description={`${data.category.name}: обзоры, подборки и полезные материалы для семей с детьми.`}
      articles={data.articles}
      page={data.page}
      totalPages={data.totalPages}
    />
  );
}
