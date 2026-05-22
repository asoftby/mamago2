import prisma from "@/lib/prisma";
import { parseArticleContentJson } from "@/lib/publications/articleMvp";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";

export type CityHomeJournalArticle = {
  slug: string;
  title: string;
  subtitle: string | null;
  category: string;
  readTime: number;
  isBreakingNews: boolean;
  publishedAt: Date | null;
  coverImageUrl: string | null;
};

function estimateReadTimeMinutes(text: string): number {
  const words = text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean).length;

  if (words <= 0) return 3;
  return Math.max(3, Math.ceil(words / 180));
}

function extractArticlePlainText(raw: unknown, excerpt: string | null): string {
  const content = parseArticleContentJson(raw);
  const blockText = content.blocks
    .map((block) => {
      switch (block.type) {
        case "intro":
        case "quote":
        case "heading":
        case "text":
          return block.text;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join(" ");

  return [excerpt ?? "", blockText].filter(Boolean).join(" ");
}

export async function listCityHomeArticles(city: {
  id: string;
  slug: string;
  name: string;
}): Promise<CityHomeJournalArticle[]> {
  const rows = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      slug: { not: null },
      publishedAt: { not: null },
      OR: [
        { cityContext: city.slug },
        { cityContext: city.name },
        { subtitle: BREAKING_NEWS_SUBTITLE, cityContext: null },
      ],
    },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    take: 6,
    select: {
      slug: true,
      title: true,
      subtitle: true,
      excerpt: true,
      contentJson: true,
      publishedAt: true,
      heroImage: true,
      coverImage: { select: { publicUrl: true } },
    },
  });

  return rows
    .filter((row): row is typeof row & { slug: string } => Boolean(row.slug))
    .map((row) => ({
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle === BREAKING_NEWS_SUBTITLE ? null : row.subtitle,
      category: row.subtitle === BREAKING_NEWS_SUBTITLE ? "Новость" : "Статья",
      isBreakingNews: row.subtitle === BREAKING_NEWS_SUBTITLE,
      readTime: estimateReadTimeMinutes(extractArticlePlainText(row.contentJson, row.excerpt)),
      publishedAt: row.publishedAt,
      coverImageUrl: row.coverImage?.publicUrl ?? row.heroImage ?? null,
    }));
}
