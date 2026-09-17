import prisma from "../src/lib/prisma";
import { ABWS_PARSER_KEY } from "../src/server/modules/import/normalizers/abws-event.normalizer";
import { upsertActivitySessionsFromOccurrences } from "../src/server/modules/import/publish/activity-session-from-occurrences";
import type { EventImportOccurrence } from "../src/server/modules/import/types";

const APPLY = process.argv.includes("--apply");
const CONFIRM = process.argv.includes("--confirm-reconcile");
const CONFIRM_PRODUCTION = process.argv.includes("--confirm-production");
const DEV_DATABASE = "devmamago";
const PROD_DATABASE = "prodmamago";

type SnapshotOccurrence = EventImportOccurrence & { withdrawnAt?: string | null };

function readOccurrences(value: unknown): SnapshotOccurrence[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = (value as Record<string, unknown>).occurrences;
  if (!Array.isArray(raw)) return null;

  const result: SnapshotOccurrence[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    result.push({
      externalId: typeof row.externalId === "string" ? row.externalId : undefined,
      startAt: typeof row.startAt === "string" ? row.startAt : undefined,
      buyUrl: typeof row.buyUrl === "string" ? row.buyUrl : undefined,
      priceMinCents: typeof row.priceMinCents === "number" ? row.priceMinCents : null,
      priceMaxCents: typeof row.priceMaxCents === "number" ? row.priceMaxCents : null,
      isSaleOpen: typeof row.isSaleOpen === "boolean" ? row.isSaleOpen : undefined,
      withdrawnAt:
        typeof row.withdrawnAt === "string"
          ? row.withdrawnAt
          : row.withdrawnAt === null
            ? null
            : undefined,
    });
  }
  return result;
}

function nextActiveAt(occurrences: SnapshotOccurrence[], now: Date): string | null {
  const next = occurrences
    .filter((occurrence) => !occurrence.withdrawnAt && occurrence.startAt)
    .map((occurrence) => new Date(occurrence.startAt!))
    .filter((date) => !Number.isNaN(date.getTime()) && date >= now)
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
      normalizedData: true,
      publishedActivityId: true,
      publishedActivity: {
        select: {
          title: true,
          nextOccurrenceAt: true,
          sessions: {
            where: { source: ABWS_PARSER_KEY },
            select: { externalId: true, startsAt: true, withdrawnAt: true },
            orderBy: { startsAt: "asc" },
          },
        },
      },
    },
    orderBy: { externalId: "asc" },
  });

  const now = new Date();
  const plan = [] as Array<Record<string, unknown>>;
  for (const record of records) {
    const occurrences = readOccurrences(record.normalizedData);
    const activityId = record.publishedActivityId;
    if (!activityId || !record.publishedActivity) continue;

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

    const expectedIds = new Set((occurrences ?? []).map((item) => item.externalId).filter(Boolean));
    const dbIds = new Set(record.publishedActivity.sessions.map((item) => item.externalId).filter(Boolean));
    const missingInDb = [...expectedIds].filter((id) => !dbIds.has(id));
    const missingInSnapshot = [...dbIds].filter((id) => !expectedIds.has(id));

    plan.push({
      importedRecordId: record.id,
      performanceId: record.externalId,
      activityId,
      title: record.publishedActivity.title,
      manualLockMode: override?.lockMode ?? null,
      snapshotOccurrences: occurrences?.length ?? null,
      dbSourceSessions: record.publishedActivity.sessions.length,
      missingInDb,
      missingInSnapshot,
      currentNextOccurrenceAt: record.publishedActivity.nextOccurrenceAt?.toISOString() ?? null,
      expectedNextOccurrenceAt: occurrences ? nextActiveAt(occurrences, now) : null,
      actionable: occurrences !== null,
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
      results.push({ activityId: row.activityId, status: "SKIPPED_NO_AUTHORITATIVE_OCCURRENCES" });
      continue;
    }
    const sourceRecord = records.find((record) => record.publishedActivityId === row.activityId);
    const occurrences = sourceRecord ? readOccurrences(sourceRecord.normalizedData) : null;
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
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
