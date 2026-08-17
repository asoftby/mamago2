import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import {
  countsFromGroupBy,
  isEmojiRatingType,
  ratingVoterIdentifier,
} from "@/lib/content-rating/emojiRating";
import { getTrustedClientIp } from "@/lib/security/clientIp";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      routeId?: unknown;
      ratingType?: unknown;
    };
    const routeId = typeof body.routeId === "string" ? body.routeId.trim() : "";
    const ratingType = body.ratingType;

    if (!routeId || !isEmojiRatingType(ratingType)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const user = await getCurrentUser();
    const identifier = ratingVoterIdentifier({
      userId: user?.id,
      ip: getTrustedClientIp(req),
    });

    const existing = await prisma.routeRating.findUnique({
      where: { routeId_identifier: { routeId, identifier } },
    });

    if (existing) {
      return NextResponse.json({ error: "Already voted" }, { status: 409 });
    }

    await prisma.routeRating.create({
      data: {
        routeId,
        ratingType,
        identifier,
        userId: user?.id ?? null,
      },
    });

    const counts = await prisma.routeRating.groupBy({
      by: ["ratingType"],
      where: { routeId },
      _count: true,
    });

    return NextResponse.json({ ok: true, counts: countsFromGroupBy(counts) });
  } catch (error) {
    console.error("Failed to rate route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
