import { NextRequest, NextResponse } from "next/server";
import { ActivityType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import { getLocalDateKey } from "@/lib/date/localDateKey";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activityId = searchParams.get("activityId");

    if (!activityId) {
      return NextResponse.json({ error: "activityId is required" }, { status: 400 });
    }

    const now = new Date();
    const publicWhere = getPublicListingActivityWhere(now);
    const publicParts = (publicWhere.AND ?? []) as Prisma.ActivityWhereInput[];

    const activity = await prisma.activity.findFirst({
      where: {
        AND: [
          { id: activityId },
          { type: ActivityType.EVENT },
          ...publicParts,
        ],
      },
      select: {
        sessions: {
          where: { startsAt: { gte: now } },
          orderBy: { startsAt: "asc" },
          select: { startsAt: true },
        },
      },
    });

    if (!activity) {
      return NextResponse.json({ dates: [] });
    }

    const unique = new Set<string>();
    for (const s of activity.sessions) {
      unique.add(getLocalDateKey(s.startsAt));
    }

    const dates = Array.from(unique).sort();
    return NextResponse.json({ dates });
  } catch (error) {
    console.error("[save/available-plan-dates] GET failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
