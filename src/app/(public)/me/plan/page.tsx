import { getCurrentUser } from "@/lib/auth/server";
import { listAllPlanItems } from "@/server/services/plan.service";
import { prisma } from "@/lib/prisma";
import { PlanPageClient } from "./PlanPageClient";
import { PlanGuestFlow } from "./PlanGuestFlow";
import { getPlanActivityPublicAvailability } from "@/lib/plan/publicVisibility";
import { getLatestActivePlanReminderNotification } from "@/server/services/notification.service";
import {
  computePlanFingerprint,
  listScenarioItemOverridesForScenarios,
} from "@/server/services/dayScenario.service";
import { resolveMyPlanItemEffectiveTime } from "@/features/my-plan/lib/scenarioProjection";

export default async function PlanPage() {
  const user = await getCurrentUser();
  if (!user) return <PlanGuestFlow />;

  // Load all plan items
  const planItems = await listAllPlanItems(user.id);

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
    where: { parentId: user.id },
    select: { birthDate: true },
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

  // Scenario status per date, so the day header can show "Собрать
  // сценарий дня" / "Открыть сценарий дня" / "...· План изменился" without
  // Scenario owning any item-selection UI here (that stays in Scenario's
  // own "План изменился" reconciliation).
  const dayScenarios = await prisma.dayScenario.findMany({
    where: { userId: user.id },
    select: { id: true, date: true, planFingerprint: true },
  });
  const itemsByDateForFingerprint = new Map<string, { id: string; startsAt: Date | null }[]>();
  for (const item of planItems) {
    const list = itemsByDateForFingerprint.get(item.date) ?? [];
    list.push({ id: item.id, startsAt: item.startsAt });
    itemsByDateForFingerprint.set(item.date, list);
  }
  const scenarioStatusByDate: Record<string, "ready" | "changed"> = {};
  for (const scenario of dayScenarios) {
    const currentItems = itemsByDateForFingerprint.get(scenario.date) ?? [];
    scenarioStatusByDate[scenario.date] =
      computePlanFingerprint(currentItems) === scenario.planFingerprint ? "ready" : "changed";
  }

  // Bounded, single-query lookup of Scenario-assigned times across every
  // date this user has a Scenario for — lets My Plan show the same
  // effective time as the Scenario without mutating PlanItem.startsAt.
  const scenarioOverridesByPlanItemId = await listScenarioItemOverridesForScenarios(
    dayScenarios.map((s) => s.id),
  );

  // Serialize plan items (dates need to be strings for client)
  const serializedItems = planItems.map((item) => {
    const effectiveStartsAt = resolveMyPlanItemEffectiveTime(
      { startsAt: item.startsAt },
      scenarioOverridesByPlanItemId.get(item.id) ?? null,
    );
    return {
      id: item.id,
      date: item.date,
      startsAt: item.startsAt ? item.startsAt.toISOString() : null,
      effectiveStartsAt: effectiveStartsAt ? effectiveStartsAt.toISOString() : null,
      activityId: item.activityId,
      title: item.title,
      coverImageUrl: item.coverImageUrl,
      planAvailability: getPlanActivityPublicAvailability(item.activity),
      activity: item.activity
        ? {
            id: item.activity.id,
            slug: item.activity.slug,
            title: item.activity.title,
            type: item.activity.type,
            coverImageUrl: item.activity.coverImageUrl,
            ageLabel: item.activity.ageLabel,
            categoryLabel: item.activity.eventCategory?.nameRu ?? null,
          }
        : null,
    };
  });

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
      initialItems={serializedItems}
      ideaActivityIds={ideaActivityIds}
      initialIdeas={serializedIdeas}
      childrenAges={childrenAges}
      scenarioStatusByDate={scenarioStatusByDate}
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
