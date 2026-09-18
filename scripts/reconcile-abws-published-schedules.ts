import prisma, { searchIndexer } from "../src/lib/prisma";
import {
  ABWS_PARSER_KEY,
  normalizeAbwsEventPayload,
} from "../src/server/modules/import/normalizers/abws-event.normalizer";
import { upsertActivitySessionsFromOccurrences } from "../src/server/modules/import/publish/activity-session-from-occurrences";
import type { EventImportOccurrence } from "../src/server/modules/import/types";

const APPLY = process.argv.includes("--apply");
const CONFIRM = process.argv.includes("--confirm-reconcile");
const CONFIRM_PRODUCTION = process.argv.includes("--confirm-production");
const DEV_DATABASE = "devmamago";
const PROD_DATABASE = "prodmamago";

type SnapshotOccurrence = EventImportOccurrence & { withdrawnAt?: string | null };

type RawRecordForNormalization = {
  rawPayload: unknown;
  sourceUrl: string | null;
  externalId: string | null;
  sourceUpdatedAt: Date | null;
  source: { slug: string };
};

/**
 * Re-normalize the stored raw ABWS snapshot with the CURRENT code instead of
 * trusting historical normalizedData. Older normalized snapshots predate
 * lifecycle fields such as withdrawnAt, while rawPayload remains the source
 * snapshot that the current normalizer knows how to interpret.
 */
function normalizeRawOccurrences(
  record: RawRecordForNormalization,
): { occurrences: SnapshotOccurrence[] | null; error: string | null } {
  if (!record.rawPayload || typeof record.rawPayload !== "object" || Array.isArray(record.rawPayload)) {
    return { occurrences: null, error: "INVALID_RAW_PAYLOAD" };
  }

  try {
    const result = normalizeAbwsEventPayload({
      rawPayload: record.rawPayload as Record<string, unknown>,
      sourceSlug: record.source.slug,
      sourceUrl: record.sourceUrl ?? "",
      externalId: record.externalId,
      sourceUpdatedAt: record.sourceUpdatedAt ?? undefined,
    });

    if (!Array.isArray(result.normalized.occurrences)) {
      return { occurrences: null, error: "NO_AUTHORITATIVE_OCCURRENCES" };
    }

    return {
      occurrences: result.normalized.occurrences as SnapshotOccurrence[],
      error: null,
    };
  } catch (error) {
    return {
      occurrences: null,
      error: error instanceof Error ? `NORMALIZATION_FAILED:${error.message}` : "NORMALIZATION_FAILED",
    };
  }
}

function nextActiveAt(occurrences: SnapshotOccurrence[], now: Date): string | null {
  const nowMs = now.getTime();
  const next = occurrences
    .filter((occurrence) => !occurrence.withdrawnAt && occurrence.startAt)
    .map((occurrence) => new Date(occurrence.startAt!))
    .filter((date) => !Number.isNaN(date.getTime()) && date.getTime() >= nowMs)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return next?.toISOString() ?? null;
}

async function main() {
  const dbRows = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
  const database = dbRows[0]?.current_database ?? "";
  if (![DEV_DATABASE, PROD_DATABASE].includes(database)) {
    throw new Error(`DATABASE_TARGET_REFUSED:${database || "<unknown>"}`);
  }
  if (APPLY && !CONFIRM) {
    throw new Error("APPLY_REQUIRES_--confirm-reconcile");
  }
  if (APPLY && database === PROD_DATABASE && !CONFIRM_PRODUCTION) {
    throw new Error("PRODUCTION_APPLY_REQUIRES_--confirm-production");
  }

  const records = await prisma.importedRecord.findMany({
    where: {
      publishedActivityId: { not: null },
      source: { parserKey: ABWS_PARSER_KEY },
    },
    select: {
      id: true,
      externalId: true,
      rawPayload: true,
      sourceUrl: true,
      sourceUpdatedAt: true,
      publishedActivityId: true,
      source: { select: { slug: true } },
      publishedActivity: {
        select: {
          title: true,
          nextOccurrenceAt: true,
          sessions: {
            select: { source: true, externalId: true, startsAt: true, withdrawnAt: true },
            orderBy: { startsAt: "asc" },
          },
        },
      },
    },
    orderBy: { externalId: "asc" },
  });

  const now = new Date();
  const plan: Array<Record<string, unknown>> = [];
  const occurrencesByActivityId = new Map<string, SnapshotOccurrence[]>();

  for (const record of records) {
    const activityId = record.publishedActivityId;
    if (!activityId || !record.publishedActivity) continue;

    const normalizedSnapshot = normalizeRawOccurrences(record);
    const occurrences = normalizedSnapshot.occurrences;
    if (occurrences) occurrencesByActivityId.set(activityId, occurrences);

    const override = await prisma.importFieldOverride.findUnique({
      where: {
        entityType_entityId_fieldName: {
          entityType: "EVENT",
          entityId: activityId,
          fieldName: "scheduleJson",
        },
      },
      select: { lockMode: true },
    });

    const sourceSessions = record.publishedActivity.sessions.filter(
      (session) => session.source === ABWS_PARSER_KEY,
    );
    const sourceNullSessions = record.publishedActivity.sessions.filter(
      (session) => session.source == null,
    );
    const expectedIds = new Set((occurrences ?? []).map((item) => item.externalId).filter(Boolean));
    const dbIds = new Set(sourceSessions.map((item) => item.externalId).filter(Boolean));
    const missingInDb = [...expectedIds].filter((id) => !dbIds.has(id));
    const missingInSnapshot = [...dbIds].filter((id) => !expectedIds.has(id));
    const manualLockMode = override?.lockMode ?? null;
    const hasManualOwnership = manualLockMode === "PREFER_MANUAL" || manualLockMode === "LOCKED";
    const actionable = occurrences !== null && sourceNullSessions.length === 0 && !hasManualOwnership;

    plan.push({
      importedRecordId: record.id,
      performanceId: record.externalId,
      activityId,
      title: record.publishedActivity.title,
      snapshotSource: "rawPayload_reNormalized_with_current_code",
      snapshotNormalizationError: normalizedSnapshot.error,
      manualLockMode,
      snapshotOccurrences: occurrences?.length ?? null,
      snapshotWithdrawnOccurrences:
        occurrences?.filter((occurrence) => Boolean(occurrence.withdrawnAt)).length ?? null,
      dbSourceSessions: sourceSessions.length,
      dbActiveSourceSessions: sourceSessions.filter((session) => session.withdrawnAt == null).length,
      dbSourceNullSessions: sourceNullSessions.length,
      sourceNullSessionStartsAt: sourceNullSessions.map((session) => session.startsAt.toISOString()),
      missingInDb,
      missingInSnapshot,
      currentNextOccurrenceAt: record.publishedActivity.nextOccurrenceAt?.toISOString() ?? null,
      expectedNextOccurrenceAt: occurrences ? nextActiveAt(occurrences, now) : null,
      actionable,
      blockedReason:
        occurrences === null
          ? normalizedSnapshot.error ?? "NO_AUTHORITATIVE_OCCURRENCES"
          : hasManualOwnership
            ? "MANUAL_OWNERSHIP"
            : sourceNullSessions.length > 0
              ? "SOURCE_NULL_SESSIONS_PRESENT"
              : null,
    });
  }

  console.log(JSON.stringify({
    mode: APPLY ? "APPLY" : "PLAN",
    database,
    records: plan,
  }, null, 2));

  if (!APPLY) return;

  const results: Array<Record<string, unknown>> = [];
  for (const row of plan) {
    if (!row.actionable || typeof row.activityId !== "string") {
      results.push({
        activityId: row.activityId,
        performanceId: row.performanceId,
        title: row.title,
        status: `SKIPPED_${String(row.blockedReason ?? "NOT_ACTIONABLE")}`,
      });
      continue;
    }

    const occurrences = occurrencesByActivityId.get(row.activityId);
    if (!occurrences) {
      results.push({ activityId: row.activityId, status: "SKIPPED_NO_AUTHORITATIVE_OCCURRENCES" });
      continue;
    }

    const synced = await upsertActivitySessionsFromOccurrences(row.activityId, occurrences);
    results.push({
      activityId: row.activityId,
      performanceId: row.performanceId,
      title: row.title,
      status: synced.blockedByManualOverride ? "SKIPPED_MANUAL_OWNERSHIP" : "SYNCED",
      ...synced,
    });
  }

  console.log(JSON.stringify({ mode: "APPLY_RESULT", database, results }, null, 2));

  // Activity updates dispatch search indexing in fire-and-forget mode. A CLI
  // must wait for those queued writes before disconnecting Prisma, otherwise
  // the engine can be closed while SearchDocument upserts are still running.
  await searchIndexer.drain();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
