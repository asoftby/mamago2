import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import {
  countsFromGroupBy,
  emptyEmojiRatingCounts,
  ratingVoterIdentifier,
} from "@/lib/content-rating/emojiRating";
import { getTrustedClientIp } from "@/lib/security/clientIp";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ routeId: string }> },
) {
  try {
    const { routeId } = await params;

    if (!routeId) {
      return NextResponse.json({ error: "Missing routeId" }, { status: 400 });
    }

    const user = await getCurrentUser();
    const identifier = ratingVoterIdentifier({
      userId: user?.id,
      ip: getTrustedClientIp(req),
    });

    const [counts, existing] = await Promise.all([
      prisma.routeRating.groupBy({
        by: ["ratingType"],
        where: { routeId },
        _count: true,
      }),
      prisma.routeRating.findUnique({
        where: { routeId_identifier: { routeId, identifier } },
        select: { ratingType: true },
      }),
    ]);

    return NextResponse.json({
      ...countsFromGroupBy(counts),
      myVote: existing?.ratingType ?? null,
    });
  } catch (error) {
    console.error("Failed to get route ratings:", error);
    return NextResponse.json({
      ...emptyEmojiRatingCounts(),
      myVote: null,
    });
  }
}
