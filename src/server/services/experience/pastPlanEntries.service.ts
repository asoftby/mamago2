import { prisma } from "@/lib/prisma";
import { activePlanScopeFor } from "@/server/family/familyAccess";
import { getLocalDateKey } from "@/lib/date/localDateKey";

const PAGE_SIZE = 20;

export type PastPlanEntry = {
  id: string;
  date: string;
  title: string;
  typeLabel: string;
  attendance: "ATTENDED" | "NOT_ATTENDED" | null;
  sentiment: "LIKE" | "NEUTRAL" | "DISLIKE" | null;
  cancelled: boolean;
};

/** Family-ACL-filtered history of saved visits, regardless of whether they were rated. */
export async function listPastPlanEntries(input: { userId: string; page: number }): Promise<{
  items: PastPlanEntry[];
  hasNext: boolean;
}> {
  const page = Math.min(50, Math.max(0, Math.trunc(input.page)));
  const rows = await prisma.planItem.findMany({
    where: {
      ...(await activePlanScopeFor(input.userId)),
      date: { lt: getLocalDateKey() },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      date: true,
      title: true,
      entryType: true,
      activityId: true,
      placeId: true,
      routeId: true,
      articleId: true,
      status: true,
      activity: { select: { title: true, type: true } },
      place: { select: { title: true } },
    },
  });
  const visible = rows.slice(0, PAGE_SIZE);
  const experiences = visible.length
    ? await prisma.experience.findMany({
        where: { sourcePlanItemId: { in: visible.map((row) => row.id) } },
        select: { sourcePlanItemId: true, attendance: true, feedbackSentiment: true },
      })
    : [];
  const stateById = new Map(experiences.map((row) => [row.sourcePlanItemId, row]));
  return {
    hasNext: rows.length > PAGE_SIZE,
    items: visible.flatMap((row) => {
      if (!row.date) return [];
      const rated = stateById.get(row.id);
      const typeLabel = row.placeId
        ? "Место"
        : row.activity?.type === "OFFER"
          ? "Предложение"
          : row.activityId || row.entryType === "EVENT"
            ? "Событие"
            : row.routeId ? "Маршрут"
            : row.articleId ? "Статья"
            : row.entryType === "TASK" ? "Заметка" : "Запись";
      return [{
        id: row.id,
        date: row.date,
        title: row.activity?.title || row.place?.title || row.title || "Запись",
        typeLabel,
        attendance: rated?.attendance ?? null,
        sentiment: rated?.feedbackSentiment ?? null,
        cancelled: row.status === "CANCELLED",
      }];
    }),
  };
}
