import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { loadArticleMvpBySlugPublic } from "@/lib/article/articleMvpRenderData";
import { getPublicPublishedArticleWhere } from "@/server/public/publicContentVisibility";
import { activeBreakingNewsContinuationWhere } from "@/lib/journal/breakingNewsContinuation";
import { buildArticlePublicPath } from "@/lib/routing/cityPaths";

/** One full article on demand; never preloads the whole news archive. */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id || id.length > 100) {
    return NextResponse.json({ error: "Invalid article" }, { status: 400 });
  }
  const now = new Date();
  const row = await prisma.article.findFirst({
    where: { ...getPublicPublishedArticleWhere(), id, ...activeBreakingNewsContinuationWhere(now) },
    select: { slug: true, geoScope: true, cityId: true, city: { select: { slug: true } } },
  });
  if (!row?.slug || (row.geoScope === "CITY" && (!row.cityId || !row.city?.slug))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const article = await loadArticleMvpBySlugPublic(row.slug, row.geoScope === "CITY" ? row.cityId : null);
  if (!article || article.id !== id || article.publicationType !== "BREAKING_NEWS") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    article: {
      id: article.id, slug: row.slug, title: article.title,
      href: buildArticlePublicPath({ slug: row.slug, geoScope: row.geoScope, citySlug: row.city?.slug }),
      citySlug: row.geoScope === "CITY" ? row.city?.slug : null,
      excerpt: article.excerpt, publishedAt: article.publishedAt,
      blocks: article.blocks, author: article.author, tags: article.tags,
      coverImageUrl: article.heroUrl,
    },
  }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
}
