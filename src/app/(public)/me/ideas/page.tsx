import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/Container";
import { IdeasClient } from "./IdeasClient";
import type { IdeaItem } from "./types";
import { getPlanActivityPublicAvailability } from "@/lib/plan/publicVisibility";

export const metadata = { title: "Мои идеи — mamaGo" };

async function getUserIdeas(userId: string): Promise<IdeaItem[]> {
  const ideas = await prisma.idea.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      // We join activity manually below via activityId
    },
  });

  if (ideas.length === 0) return [];

  const activityIds = ideas.map((i) => i.activityId);

  const activities = await prisma.activity.findMany({
    where: { id: { in: activityIds } },
    select: {
      id: true,
      title: true,
      type: true,
      coverImageUrl: true,
      ageLabel: true,
      status: true,
      nextOccurrenceAt: true,
      sessions: {
        orderBy: { startsAt: "asc" },
        take: 1,
        select: { startsAt: true },
      },
      owner: {
        select: {
          business: { select: { operationalStatus: true } },
        },
      },
      place: {
        select: {
          city: { select: { name: true } },
        },
      },
    },
  });

  const activityMap = new Map(activities.map((a) => [a.id, a]));

  // Check which activities are already planned
  const plannedItems = await prisma.planItem.findMany({
    where: { userId, activityId: { in: activityIds } },
    select: { activityId: true, date: true },
    orderBy: { date: "asc" },
  });
  const plannedMap = new Map(plannedItems.map((p) => [p.activityId!, p.date]));

  return ideas
    .map((idea) => {
      const activity = activityMap.get(idea.activityId);
      if (!activity) return null;

      const session = activity.sessions[0];
      const dateStart = session?.startsAt?.toISOString().split("T")[0];
      const dateEnd = undefined;
      const plannedDate = plannedMap.get(idea.activityId);

      return {
        id: idea.id,
        activity: {
          id: activity.id,
          title: activity.title,
          type: activity.type as IdeaItem["activity"]["type"],
          coverImageUrl: activity.coverImageUrl ?? undefined,
          city: activity.place?.city?.name ?? undefined,
          ageRange: activity.ageLabel ?? undefined,
          dateStart,
          dateEnd,
        },
        planAvailability: getPlanActivityPublicAvailability(activity),
        isPlanned: !!plannedDate,
        plannedDate: plannedDate ?? undefined,
        createdAt: idea.createdAt.toISOString(),
      } satisfies IdeaItem;
    })
    .filter(Boolean) as IdeaItem[];
}

export default async function IdeasPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ideas = await getUserIdeas(user.id);

  return (
    <div className="min-h-screen bg-background py-8">
      <Container className="max-w-6xl">
        <IdeasClient initialIdeas={ideas} />
      </Container>
    </div>
  );
}
