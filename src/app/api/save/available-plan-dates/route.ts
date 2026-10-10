import { NextRequest, NextResponse } from "next/server";
import { ActivityType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import { getLocalDateKey } from "@/lib/date/localDateKey";
import { formatHHMM } from "@/lib/formatters/date";

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
          where: { startsAt: { gte: now }, withdrawnAt: null },
          orderBy: { startsAt: "asc" },
          select: { id: true, startsAt: true },
        },
      },
    });

    if (!activity) {
      return NextResponse.json({ dates: [], sessionsByDate: {} });
    }

    const unique = new Set<string>();
    const sessionsByDate: Record<string, Array<{ id: string; time: string }>> = {};
    for (const s of activity.sessions) {
      const key = getLocalDateKey(s.startsAt);
      unique.add(key);
      (sessionsByDate[key] ??= []).push({ id: s.id, time: formatHHMM(s.startsAt) });
    }

    const dates = Array.from(unique).sort();
    return NextResponse.json({ dates, sessionsByDate });
  } catch (error) {
    console.error("[save/available-plan-dates] GET failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
