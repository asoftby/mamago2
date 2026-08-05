import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import {
  countsFromGroupBy,
  isEmojiRatingType,
  ratingVoterIdentifier,
} from "@/lib/content-rating/emojiRating";

async function assertPublicArticle(articleId: string) {
  return prisma.article.findFirst({
    where: {
      id: articleId,
      status: "PUBLISHED",
      OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
    },
    select: { id: true },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      articleId?: unknown;
      ratingType?: unknown;
    };
    const articleId =
      typeof body.articleId === "string" ? body.articleId.trim() : "";
    const ratingType = body.ratingType;

    if (!articleId || !isEmojiRatingType(ratingType)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const article = await assertPublicArticle(articleId);
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const user = await getCurrentUser();
    const identifier = ratingVoterIdentifier({
      userId: user?.id,
      forwardedFor: req.headers.get("x-forwarded-for"),
      realIp: req.headers.get("x-real-ip"),
    });

    const existing = await prisma.articleRating.findUnique({
      where: { articleId_identifier: { articleId, identifier } },
    });
    if (existing) {
      return NextResponse.json({ error: "Already voted" }, { status: 409 });
    }

    await prisma.articleRating.create({
      data: {
        articleId,
        ratingType,
        identifier,
        userId: user?.id ?? null,
      },
    });

    const counts = await prisma.articleRating.groupBy({
      by: ["ratingType"],
      where: { articleId },
      _count: true,
    });

    return NextResponse.json({
      ok: true,
      counts: countsFromGroupBy(counts),
    });
  } catch (error) {
    console.error("Failed to rate article:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
