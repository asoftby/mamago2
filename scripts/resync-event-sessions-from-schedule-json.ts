import { ActivityType, ContentStatus, type Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import {
  eventSessionFingerprintFromStoredSessions,
  eventSessionScheduleFingerprint,
  replaceActivitySessionsFromScheduleJson,
} from "@/lib/business/syncEventActivitySessions";
import { syncActivityNextOccurrenceAt } from "@/lib/business/eventMutationSideEffects";
import { extractScheduleOccurrences } from "@/lib/event/materializeScheduleSessions";

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

const apply = process.argv.includes("--apply");
const activityId = argValue("activity-id");
const slug = argValue("slug");

async function main() {
  const where: Prisma.ActivityWhereInput = {
    type: ActivityType.EVENT,
    status: {
      notIn: [ContentStatus.ARCHIVED, ContentStatus.DELETED],
    },
    ...(activityId ? { id: activityId } : {}),
    ...(slug ? { slug } : {}),
  };

  const activities = await prisma.activity.findMany({
    where,
    orderBy: { id: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      scheduleJson: true,
      nextOccurrenceAt: true,
      sessions: {
        orderBy: { startsAt: "asc" },
        select: { startsAt: true },
      },
    },
  });

  let mismatched = 0;
  let repaired = 0;

  for (const activity of activities) {
    if (!activity.scheduleJson) continue;

    const desiredOccurrences = extractScheduleOccurrences(activity.scheduleJson);
    const desiredFingerprint = eventSessionScheduleFingerprint(activity.scheduleJson);
    const actualFingerprint = eventSessionFingerprintFromStoredSessions(activity.sessions);

    if (desiredFingerprint === actualFingerprint) continue;

    mismatched += 1;
    const record = {
      activityId: activity.id,
      slug: activity.slug,
      title: activity.title,
      status: activity.status,
      actualSessions: activity.sessions.length,
      desiredSessions: desiredOccurrences.length,
      currentNextOccurrenceAt: activity.nextOccurrenceAt?.toISOString() ?? null,
    };

    if (!apply) {
      console.log(JSON.stringify({ action: "DRY_RUN_MISMATCH", ...record }));
      continue;
    }

    const result = await prisma.$transaction(async (tx) => {
      const sessionsWritten = await replaceActivitySessionsFromScheduleJson({
        prisma: tx,
        activityId: activity.id,
        scheduleJson: activity.scheduleJson,
      });
      const nextOccurrenceAt = await syncActivityNextOccurrenceAt({
        prisma: tx,
        activityId: activity.id,
      });
      return { sessionsWritten, nextOccurrenceAt };
    });

    repaired += 1;
    console.log(
      JSON.stringify({
        action: "REPAIRED",
        ...record,
        sessionsWritten: result.sessionsWritten,
        nextOccurrenceAt: result.nextOccurrenceAt?.toISOString() ?? null,
      }),
    );
  }

  console.log(
    JSON.stringify({
      mode: apply ? "APPLY" : "DRY_RUN",
      scanned: activities.length,
      mismatched,
      repaired,
      filters: { activityId, slug },
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
