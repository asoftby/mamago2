import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { loadArticleMvpBySlugPublic } from "@/lib/article/articleMvpRenderData";
import { getPublicPublishedArticleWhere } from "@/server/public/publicContentVisibility";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";
import { activeBreakingNewsContinuationWhere } from "@/lib/journal/breakingNewsContinuation";

/** One full article on demand; never preloads the whole news archive. */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const city = request.nextUrl.searchParams.get("city");
  if (!id || id.length > 100 || (city !== null && !/^[a-z0-9-]{1,80}$/.test(city))) {
    return NextResponse.json({ error: "Invalid article" }, { status: 400 });
  }
  const cityRow = city ? await prisma.city.findFirst({
    where: { slug: city, isActive: true },
    select: { id: true },
  }) : null;
  if (city && !cityRow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const scopeWhere = cityRow ? { cityId: cityRow.id, geoScope: "CITY" as const } : { geoScope: "COUNTRY" as const };
  const now = new Date();
  const row = await prisma.article.findFirst({
    where: { ...getPublicPublishedArticleWhere(), id, ...scopeWhere, ...activeBreakingNewsContinuationWhere(now) },
    select: { slug: true },
  });
  if (!row?.slug) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const article = await loadArticleMvpBySlugPublic(row.slug, cityRow?.id ?? null);
  if (!article || article.id !== id || article.subtitle !== BREAKING_NEWS_SUBTITLE) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    article: {
      id: article.id, slug: article.slug, title: article.title,
      excerpt: article.excerpt, publishedAt: article.publishedAt,
      blocks: article.blocks, author: article.author, tags: article.tags,
      coverImageUrl: article.heroUrl,
    },
  }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
}
