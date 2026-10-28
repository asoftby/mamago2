import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPublicPublishedArticleWhere } from "@/server/public/publicContentVisibility";

const PAGE_SIZE = 3;

/**
 * Lightweight metadata-only cursor feed. Full article content is fetched only
 * after the reader actually opens a card; this endpoint never selects contentJson.
 */
export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get("cursor");
  if (!cursor || cursor.length > 100) {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  }

  const anchor = await prisma.article.findFirst({
    where: { ...getPublicPublishedArticleWhere(), subtitle: "__breaking_news__", id: cursor },
    select: { id: true, publishedAt: true },
  });
  if (!anchor?.publishedAt) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  const rows = await prisma.article.findMany({
    where: {
      ...getPublicPublishedArticleWhere(),
      subtitle: "__breaking_news__",
      publishedAt: {
        not: null,
        lte: anchor.publishedAt,
      },
      OR: [
        { publishedAt: { lt: anchor.publishedAt } },
        { publishedAt: anchor.publishedAt, id: { lt: anchor.id } },
      ],
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    select: { id: true, slug: true, title: true, excerpt: true, publishedAt: true, heroImage: true, seoOgImage: true },
  });

  const items = rows.slice(0, PAGE_SIZE).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    publishedAt: row.publishedAt,
    coverImageUrl: row.heroImage ?? row.seoOgImage,
  }));
  return NextResponse.json(
    { items, nextCursor: rows.length > PAGE_SIZE ? items.at(-1)?.id ?? null : null },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
  );
}
