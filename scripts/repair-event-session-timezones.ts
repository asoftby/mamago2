import { PrismaClient } from "@prisma/client";

import {
  eventSessionFingerprintFromStoredSessions,
  eventSessionScheduleFingerprint,
} from "../src/lib/business/syncEventActivitySessions";
import { syncActivityNextOccurrenceAt } from "../src/lib/business/eventMutationSideEffects";
import { buildEventSessionTimezoneRepairPlan } from "../src/lib/event/eventSessionTimezoneRepair";
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
  let timezoneCandidates = 0;
  let unrelatedMismatches = 0;
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
      const repairPlan = buildEventSessionTimezoneRepairPlan(
        activity.scheduleJson,
        activity.sessions,
      );

      if (repairPlan.kind !== "legacy-utc-wall-clock") {
        unrelatedMismatches += 1;
        console.log(
          JSON.stringify({
            activityId: activity.id,
            title: activity.title,
            status: activity.status,
            classification: "skip-unrelated",
            reason: repairPlan.reason,
            desiredFingerprint,
            actualFingerprint,
            sessions: activity.sessions.length,
            mode,
          }),
        );
        continue;
      }

      timezoneCandidates += 1;
      const desiredByDate = new Map(
        repairPlan.entries.map((entry) => [entry.dateKey, entry.desiredStartsAt] as const),
      );
      const legacyByDate = new Map(
        repairPlan.entries.map((entry) => [entry.dateKey, entry.legacyStartsAt] as const),
      );
      const dates = repairPlan.entries.map((entry) => entry.dateKey);

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
        const legacyStartsAt = legacyByDate.get(item.date);
        const desiredStartsAt = desiredByDate.get(item.date);
        if (!legacyStartsAt || !desiredStartsAt) return [];
        if (item.startsAt.getTime() !== legacyStartsAt.getTime()) return [];
        if (item.startsAt.getTime() === desiredStartsAt.getTime()) return [];
        return [{ id: item.id, startsAt: desiredStartsAt }];
      });

      console.log(
        JSON.stringify({
          activityId: activity.id,
          title: activity.title,
          status: activity.status,
          classification: "timezone-candidate",
          reason: repairPlan.reason,
          sessions: activity.sessions.length,
          planItemsToRepair: planRepairs.length,
          sample: repairPlan.entries.slice(0, 3).map((entry) => ({
            date: entry.dateKey,
            before: entry.legacyStartsAt.toISOString(),
            after: entry.desiredStartsAt.toISOString(),
          })),
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
          data: repairPlan.entries.map((entry) => ({
            activityId: activity.id,
            startsAt: entry.desiredStartsAt,
          })),
        });

        await syncActivityNextOccurrenceAt({
          prisma: tx,
          activityId: activity.id,
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
        timezoneCandidates,
        unrelatedMismatches,
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
