import { NextRequest, NextResponse } from "next/server";
import { ActivityType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import { getLocalDateKey } from "@/lib/date/localDateKey";
import { formatHHMM } from "@/lib/formatters/date";
import { resolveActivityTicketLocation } from "@/lib/plan/activityTicketLocation";

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
        // The save heart is also shown in catalogue cards. Return ticket details
        // with the existing date request instead of adding another API call.
        format: true,
        priceMode: true,
        priceFrom: true,
        priceText: true,
        place: {
          select: { title: true, formattedAddr: true, shortAddress: true, customAddress: true },
        },
        venue: {
          select: {
            kind: true,
            title: true,
            addressLine: true,
            place: { select: { title: true, formattedAddr: true, shortAddress: true, customAddress: true } },
          },
        },
        sessions: {
          where: { startsAt: { gte: now }, withdrawnAt: null },
          orderBy: { startsAt: "asc" },
          select: { id: true, startsAt: true, title: true },
        },
      },
    });

    if (!activity) {
      return NextResponse.json({ dates: [], sessionsByDate: {} });
    }

    const unique = new Set<string>();
    const sessionsByDate: Record<string, Array<{ id: string; time: string; title?: string }>> = {};
    for (const s of activity.sessions) {
      const key = getLocalDateKey(s.startsAt);
      unique.add(key);
      (sessionsByDate[key] ??= []).push({
        id: s.id,
        time: formatHHMM(s.startsAt),
        ...(s.title ? { title: s.title } : {}),
      });
    }

    const dates = Array.from(unique).sort();
    const ticketLocation = resolveActivityTicketLocation(activity);
    const mode = activity.priceMode;
    return NextResponse.json({
      dates,
      sessionsByDate,
      ticket: {
        ...ticketLocation,
        // Match public event page legacy pricing: zero means free, a positive
        // priceFrom without an explicit mode is the minimum entry price.
        priceMode: mode === "RANGE" ? "FROM" :
          mode === "FREE" || mode === "FROM" || mode === "EXACT" ? mode :
            mode === "UNKNOWN" && !activity.priceText && activity.priceFrom === 0 ? "FREE" :
              mode === "UNKNOWN" && !activity.priceText && (activity.priceFrom ?? 0) > 0 ? "FROM" : "UNKNOWN",
        priceValue: activity.priceFrom,
        priceLabel: activity.priceText,
      },
    });
  } catch (error) {
    console.error("[save/available-plan-dates] GET failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
