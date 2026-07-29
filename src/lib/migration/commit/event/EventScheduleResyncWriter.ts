import type { PrismaClient } from "@prisma/client";

import { syncActivityNextOccurrenceAt } from "@/lib/business/eventMutationSideEffects";
import { replaceActivitySessionsFromScheduleJson } from "@/lib/business/syncEventActivitySessions";
import type { NormalizedEventScheduleDraft } from "../../adapters/wordpress-db/normalizeEvent";

/**
 * Deliberately the narrowest possible write surface — by construction, not
 * convention: this type has no `activity.update` with a general `data` bag,
 * no `eventVenue`, no `migrationLineage`/`migrationRecord`. It is
 * structurally impossible to touch `status`/`cityId`/`slug`/`title`/
 * `ownerUserId`/media/lineage through this client, because those delegates
 * and fields simply aren't present on the type. This is the resync tool's
 * entire write scope: `ActivitySession` rows and `Activity.nextOccurrenceAt`
 * (via the same two existing functions the Event commit writer already
 * uses for CREATE/UPDATE — no reimplementation).
 */
export interface EventScheduleResyncTransactionClient {
  activity: Pick<PrismaClient["activity"], "update">;
  activitySession: Pick<
    PrismaClient["activitySession"],
    "createMany" | "deleteMany" | "findFirst" | "findMany"
  >;
}

export interface EventScheduleResyncWriterPrismaClient {
  $transaction<T>(fn: (tx: EventScheduleResyncTransactionClient) => Promise<T>): Promise<T>;
}

export interface EventScheduleResyncResult {
  activityId: string;
  sessionsWritten: number;
  nextOccurrenceAt: Date | null;
}

/**
 * One transaction, one Activity: delete+recreate `ActivitySession` rows
 * from the source-derived `scheduleDraft`, then resync `nextOccurrenceAt`
 * from whatever sessions now exist. Both steps already exist and are
 * already used by `EventCommitWriter` for CREATE/UPDATE — this function
 * reuses them verbatim, it does not reimplement session materialization.
 *
 * No `status`, `cityId`, `slug`, `title`, `ownerUserId`, venue, media, or
 * `MigrationLineage` write is reachable from here — see
 * `EventScheduleResyncTransactionClient`.
 */
export async function resyncEventScheduleSessions(
  prisma: EventScheduleResyncWriterPrismaClient,
  input: { activityId: string; scheduleDraft: NormalizedEventScheduleDraft },
): Promise<EventScheduleResyncResult> {
  return prisma.$transaction(async (tx) => {
    const sessionsWritten = await replaceActivitySessionsFromScheduleJson({
      prisma: tx,
      activityId: input.activityId,
      scheduleJson: input.scheduleDraft,
    });
    const nextOccurrenceAt = await syncActivityNextOccurrenceAt({
      prisma: tx,
      activityId: input.activityId,
    });
    return { activityId: input.activityId, sessionsWritten, nextOccurrenceAt };
  });
}
