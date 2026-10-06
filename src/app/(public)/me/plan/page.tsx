import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { PlanPageClient } from "./PlanPageClient";
import { PlanGuestFlow } from "./PlanGuestFlow";
import { getLatestActivePlanReminderNotification } from "@/server/services/notification.service";
import {
  listPendingExperienceCandidates,
  listRecentExperienceSummaries,
} from "@/server/services/experience/experience.service";
import { childScopeFor, activeFamilyUserIds } from "@/server/family/familyAccess";
import { familyReadsEnabled } from "@/server/family/familyScope";
import { loadFamilyCalendarRange } from "@/server/services/familyCalendar.service";
import { resolvePlanOwner } from "@/server/services/planOwner";
import { getLocalDateKey } from "@/lib/date/localDateKey";
import { calendarWeekRange, resolveCalendarDateParam } from "@/features/my-plan/lib/familyCalendarNavigation";

export default async function PlanPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <PlanGuestFlow />;

  const params = await searchParams;
  const selectedDate = resolveCalendarDateParam(params?.date, getLocalDateKey());
  const { from: initialFrom, to: initialTo } = calendarWeekRange(selectedDate);
  const calendar = await loadFamilyCalendarRange({
    owner: await resolvePlanOwner(user.id),
    from: initialFrom,
    to: initialTo,
  });
  const adultIds = familyReadsEnabled() ? await activeFamilyUserIds(user.id) : [user.id];
  const familyView = adultIds.length > 1 ? { currentUserId: user.id, adultsCount: adultIds.length } : null;
  const [experienceCandidates, recentExperiences] = await Promise.all([
    listPendingExperienceCandidates({ userId: user.id, lookbackDays: 14, take: 3 }),
    listRecentExperienceSummaries({ userId: user.id, take: 1 }),
  ]);

  // Load saved ideas for the sidebar
  const ideas = await prisma.idea.findMany({
    where: { userId: user.id },
    select: { id: true, activityId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const ideaActivityIds = ideas.map((i) => i.activityId);

  // Fetch activity details for ideas
  const ideaActivities = ideaActivityIds.length > 0
    ? await prisma.activity.findMany({
        where: { id: { in: ideaActivityIds } },
        select: { id: true, title: true, coverImageUrl: true, type: true, ageLabel: true, slug: true },
      })
    : [];
  const ideaActivityMap = new Map(ideaActivities.map((a) => [a.id, a]));

  // Load children for family recommendations
  const children = await prisma.child.findMany({
    where: await childScopeFor(user.id),
    select: { id: true, name: true, birthDate: true },
    orderBy: { createdAt: "asc" },
  });

  // Compute children ages
  const today = new Date();
  const childrenAges = children
    .filter((c): c is typeof c & { birthDate: Date } => c.birthDate != null)
    .map((c) => {
      const birth = new Date(c.birthDate);
      return today.getFullYear() - birth.getFullYear();
    });

  const activeReminder = await getLatestActivePlanReminderNotification(user.id);

  const serializedIdeas = ideas.map((idea) => {
    const act = ideaActivityMap.get(idea.activityId) ?? null;
    return {
      id: idea.id,
      activityId: idea.activityId,
      createdAt: idea.createdAt.toISOString(),
      activity: act
        ? { id: act.id, title: act.title, coverImageUrl: act.coverImageUrl, type: act.type, ageLabel: act.ageLabel, slug: act.slug }
        : null,
    };
  });

  return (
    <PlanPageClient
      initialItems={calendar.items}
      initialSelectedDate={selectedDate}
      initialRange={{ from: initialFrom, to: initialTo }}
      familyChildren={children.map((child) => ({ id: child.id, name: child.name?.trim() || "Ребёнок" }))}
      familyView={familyView}
      ideaActivityIds={ideaActivityIds}
      initialIdeas={serializedIdeas}
      childrenAges={childrenAges}
      scenarioStatusByDate={calendar.scenarioStatusByDate}
      experienceCandidates={experienceCandidates.map((candidate) => ({
        ...candidate,
        plannedStartsAt: candidate.plannedStartsAt?.toISOString() ?? null,
      }))}
      recentExperiences={recentExperiences}
      activeReminder={
        activeReminder
          ? {
              id: activeReminder.id,
              title: activeReminder.title,
              body: activeReminder.body,
              ctaLabel: activeReminder.ctaLabel,
              ctaAction: activeReminder.ctaAction,
              createdAt: activeReminder.createdAt.toISOString(),
              isRead: activeReminder.readAt != null,
            }
          : null
      }
    />
  );
}
