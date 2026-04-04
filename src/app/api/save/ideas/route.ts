import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

const activitySelect = {
  id: true,
  slug: true,
  title: true,
  type: true,
  coverImageUrl: true,
  ageLabel: true,
  eventCategory: { select: { nameRu: true } },
  priceFrom: true,
  priceText: true,
  currency: true,
  status: true,
  owner: {
    select: {
      business: { select: { operationalStatus: true } },
    },
  },
  place: {
    select: {
      shortAddress: true,
      formattedAddr: true,
      customAddress: true,
      city: { select: { name: true } },
    },
  },
  venue: {
    select: {
      addressLine: true,
      kind: true,
      place: {
        select: {
          shortAddress: true,
          formattedAddr: true,
          customAddress: true,
          city: { select: { name: true } },
        },
      },
    },
  },
  scheduleJson: true,
} as const;

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? undefined;

    const ideas = await prisma.idea.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const activityIds = [...new Set(ideas.map((i) => i.activityId))].filter(
      Boolean
    );

    const activities = activityIds.length
      ? await prisma.activity.findMany({
          where: { id: { in: activityIds } },
          select: activitySelect,
        })
      : [];

    const activityById = new Map(activities.map((a) => [a.id, a]));

    const planned = activityIds.length
      ? await prisma.planItem.findMany({
          where: {
            userId: user.id,
            activityId: { in: activityIds },
            ...(date ? { date } : {}),
          },
          select: { activityId: true },
        })
      : [];
    const plannedIds = new Set(planned.map((item) => item.activityId).filter(Boolean));

    const payload = ideas
      .map((idea) => {
        const activity = activityById.get(idea.activityId);
        if (!activity) return null;
        return {
          id: idea.id,
          activityId: idea.activityId,
          createdAt: idea.createdAt.toISOString(),
          activity,
          inPlanOnDate: plannedIds.has(idea.activityId),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    return NextResponse.json({ ideas: payload });
  } catch (error) {
    console.error("List ideas error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
