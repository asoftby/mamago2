import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import {
  countsFromGroupBy,
  emptyEmojiRatingCounts,
  ratingVoterIdentifier,
} from "@/lib/content-rating/emojiRating";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ articleId: string }> },
) {
  try {
    const { articleId: rawId } = await params;
    const articleId = rawId?.trim() ?? "";
    if (!articleId) {
      return NextResponse.json({ error: "Missing articleId" }, { status: 400 });
    }

    const article = await prisma.article.findFirst({
      where: {
        id: articleId,
        status: "PUBLISHED",
      },
      select: { id: true },
    });
    if (!article) {
      return NextResponse.json({
        ...emptyEmojiRatingCounts(),
        myVote: null,
      });
    }

    const user = await getCurrentUser();
    const identifier = ratingVoterIdentifier({
      userId: user?.id,
      forwardedFor: req.headers.get("x-forwarded-for"),
      realIp: req.headers.get("x-real-ip"),
    });

    const [counts, existing] = await Promise.all([
      prisma.articleRating.groupBy({
        by: ["ratingType"],
        where: { articleId },
        _count: true,
      }),
      prisma.articleRating.findUnique({
        where: { articleId_identifier: { articleId, identifier } },
        select: { ratingType: true },
      }),
    ]);

    return NextResponse.json({
      ...countsFromGroupBy(counts),
      myVote: existing?.ratingType ?? null,
    });
  } catch (error) {
    console.error("Failed to get article ratings:", error);
    return NextResponse.json({
      ...emptyEmojiRatingCounts(),
      myVote: null,
    });
  }
}
