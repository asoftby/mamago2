import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = currentUser.id;

  const [user, ideasRaw, planItemsRaw] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phoneE164: true,
        createdAt: true,
      },
    }),
    prisma.idea.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        activityId: true,
        createdAt: true,
      },
    }),
    prisma.planItem.findMany({
      where: { userId },
      orderBy: [{ date: "asc" }, { startsAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        date: true,
        startsAt: true,
        createdAt: true,
        title: true,
        coverImageUrl: true,
        activityId: true,
        routeId: true,
        planRouteSlug: true,
        activity: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        route: {
          select: {
            id: true,
            slug: true,
            title: true,
          },
        },
      },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const activityIds = Array.from(new Set(ideasRaw.map((idea) => idea.activityId)));
  const ideaActivities = activityIds.length
    ? await prisma.activity.findMany({
        where: { id: { in: activityIds } },
        select: {
          id: true,
          title: true,
          slug: true,
        },
      })
    : [];

  const ideaActivityById = new Map(ideaActivities.map((activity) => [activity.id, activity]));

  const ideas = ideasRaw.map((idea) => ({
    ...idea,
    activity: ideaActivityById.get(idea.activityId) ?? null,
  }));

  const plansByDate = new Map<string, typeof planItemsRaw>();
  for (const item of planItemsRaw) {
    const existing = plansByDate.get(item.date) ?? [];
    existing.push(item);
    plansByDate.set(item.date, existing);
  }

  const plans = Array.from(plansByDate.entries()).map(([date, items]) => ({
    date,
    items,
  }));

  const payload = {
    user: {
      id: user.id,
      email: user.email,
      phone: user.phoneE164,
      createdAt: user.createdAt,
    },
    ideas,
    plans,
    exportedAt: new Date().toISOString(),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mamago-data.json"',
      "Cache-Control": "no-store",
    },
  });
}
