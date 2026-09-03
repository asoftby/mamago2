import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { buildArticlePublicPath } from "@/lib/routing/cityPaths";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ideas = await prisma.articleIdea.findMany({
    where: {
      userId: user.id,
      article: {
        status: "PUBLISHED",
        slug: { not: null },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      article: {
        select: {
          id: true,
          slug: true,
          title: true,
          geoScope: true,
          heroImage: true,
          seoOgImage: true,
          coverImage: { select: { publicUrl: true } },
          city: { select: { slug: true } },
          category: { select: { nameRu: true } },
        },
      },
    },
  });

  const items = ideas.flatMap((idea) => {
    const article = idea.article;
    const slug = article.slug?.trim();
    if (!slug) return [];

    return [
      {
        id: idea.id,
        ideaType: "ARTICLE" as const,
        activity: {
          id: article.id,
          title: article.title,
          type: "ARTICLE" as const,
          coverImageUrl:
            article.coverImage?.publicUrl ?? article.heroImage ?? article.seoOgImage ?? null,
          publicHref: buildArticlePublicPath({
            slug,
            geoScope: article.geoScope,
            citySlug: article.city?.slug ?? null,
          }),
          categoryLabel: article.category?.nameRu ?? "статья",
        },
        planStatus: "UNPLANNED" as const,
        isPlanned: false,
        createdAt: idea.createdAt.toISOString(),
      },
    ];
  });

  return NextResponse.json({ items });
}
