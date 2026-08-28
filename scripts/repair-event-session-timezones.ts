import { PrismaClient } from "@prisma/client";

import {
  eventSessionFingerprintFromStoredSessions,
  eventSessionScheduleFingerprint,
} from "../src/lib/business/syncEventActivitySessions";
import { extractScheduleDatesAndStartTime } from "../src/lib/event/materializeScheduleSessions";
import { getLocalDateKey, localWallClockToUtc } from "../src/lib/date/localDateKey";
import { SearchIndexerService } from "../src/lib/search/SearchIndexerService";

function parseMode(argv: readonly string[]): "preview" | "commit" {
  const preview = argv.includes("--preview");
  const commit = argv.includes("--commit");
  if (preview === commit) {
    throw new Error("Pass exactly one of --preview or --commit.");
  }
  return commit ? "commit" : "preview";
}

type RepairCandidate = {
  activityId: string;
  title: string;
  status: string;
  scheduleJson: unknown;
  sessions: Array<{ id: string; startsAt: Date }>;
};

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  const prisma = new PrismaClient();
  const indexer = new SearchIndexerService(prisma);

  let scanned = 0;
  let mismatched = 0;
  let repairedActivities = 0;
  let repairedPlanItems = 0;

  try {
    const activities = (await prisma.activity.findMany({
      where: {
        scheduleJson: { not: null },
        sessions: { some: {} },
      },
      select: {
        id: true,
        title: true,
        status: true,
        scheduleJson: true,
        sessions: {
          orderBy: { startsAt: "asc" },
          select: { id: true, startsAt: true },
        },
      },
      orderBy: { id: "asc" },
    })) as RepairCandidate[];

    for (const activity of activities) {
      scanned += 1;
      const desiredFingerprint = eventSessionScheduleFingerprint(activity.scheduleJson);
      const actualFingerprint = eventSessionFingerprintFromStoredSessions(activity.sessions);
      if (desiredFingerprint === actualFingerprint) continue;

      mismatched += 1;
      const { dates, startTime } = extractScheduleDatesAndStartTime(activity.scheduleJson);
      const desiredByDate = new Map(
        dates.map((dateKey) => [dateKey, localWallClockToUtc(dateKey, startTime)] as const),
      );

      const currentStartsByDate = new Map<string, Set<number>>();
      for (const session of activity.sessions) {
        const dateKey = getLocalDateKey(session.startsAt);
        const set = currentStartsByDate.get(dateKey) ?? new Set<number>();
        set.add(session.startsAt.getTime());
        currentStartsByDate.set(dateKey, set);
      }

      const planItems = await prisma.planItem.findMany({
        where: {
          activityId: activity.id,
          startsAt: { not: null },
          date: { in: dates },
        },
        select: { id: true, date: true, startsAt: true },
      });

      const planRepairs = planItems.flatMap((item) => {
        if (!item.startsAt) return [];
        const currentSessionInstants = currentStartsByDate.get(item.date);
        const desiredStartsAt = desiredByDate.get(item.date);
        if (!currentSessionInstants || !desiredStartsAt) return [];
        if (!currentSessionInstants.has(item.startsAt.getTime())) return [];
        if (item.startsAt.getTime() === desiredStartsAt.getTime()) return [];
        return [{ id: item.id, startsAt: desiredStartsAt }];
      });

      console.log(
        JSON.stringify({
          activityId: activity.id,
          title: activity.title,
          status: activity.status,
          desiredFingerprint,
          actualFingerprint,
          sessions: activity.sessions.length,
          planItemsToRepair: planRepairs.length,
          mode,
        }),
      );

      if (mode === "preview") continue;

      await prisma.$transaction(async (tx) => {
        for (const repair of planRepairs) {
          await tx.planItem.update({
            where: { id: repair.id },
            data: { startsAt: repair.startsAt },
          });
        }

        await tx.activitySession.deleteMany({ where: { activityId: activity.id } });
        await tx.activitySession.createMany({
          data: dates.map((dateKey) => ({
            activityId: activity.id,
            startsAt: desiredByDate.get(dateKey)!,
          })),
        });
      });

      repairedActivities += 1;
      repairedPlanItems += planRepairs.length;

      if (activity.status === "PUBLISHED") {
        await indexer.upsertActivity(activity.id);
      }
    }

    console.log(
      JSON.stringify({
        mode,
        scanned,
        mismatched,
        repairedActivities,
        repairedPlanItems,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
