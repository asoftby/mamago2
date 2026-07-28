/**
 * Safe, narrow Event schedule resync CLI.
 *
 * Purpose: `migration-commit-wordpress-db.ts` proves "has the source
 * *content* changed" via a canonical hash — correctly, and it must keep
 * doing exactly that. But that hash says nothing about whether the
 * `ActivitySession` rows materialized from a still-unchanged multi-date
 * schedule are still accurate as calendar days pass (a schedule spanning
 * past and future dates prunes past sessions purely as a function of
 * *today's date*, not of any source content change) — so a content-hash
 * match (`SKIP_UNCHANGED`) can sit forever on top of a stale session list.
 * This CLI is the dedicated, narrow tool for exactly that gap. It never
 * creates an Event, never touches `status`/`cityId`/`slug`/`title`/
 * `ownerUserId`/venue/media/lineage — see `EventScheduleResyncWriter.ts`'s
 * `EventScheduleResyncTransactionClient` for why that's structurally, not
 * just conventionally, true.
 *
 * Run (read-only):
 *   pnpm migration:events:sessions-resync \
 *     --source-record-key wordpress-db:events:62977 \
 *     --source-record-key wordpress-db:events:63510 \
 *     --preview --allow-remote-readonly
 *
 * Run (write, one transaction per key, sequential, stop-on-first-error):
 *   pnpm migration:events:sessions-resync \
 *     --source-record-key wordpress-db:events:62977 \
 *     --commit --allow-remote-readonly --out report.json
 *
 * Required env vars (same as migration:preview:wordpress-db): WP_SSH_HOST,
 * WP_SSH_USER, WP_DB_NAME, WP_DB_USER, WP_DB_PASSWORD. A non-localhost
 * WP_SSH_HOST additionally requires --allow-remote-readonly. mamaGo's own
 * DATABASE_URL is read implicitly by `new PrismaClient()`.
 */
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import {
  assertRemoteAccessAllowed,
  createWordPressSshMysqlExecutor,
  readWordPressDbConfigFromEnv,
} from "../src/lib/migration/adapters/wordpress-db/connectExecutor";
import {
  fetchPublishedEventEnvelopeBySourceRecordKey,
} from "../src/lib/migration/adapters/wordpress-db/wordpressDbAdapter";
import { normalizeEvent } from "../src/lib/migration/adapters/wordpress-db/normalizeEvent";
import type { WordPressEventBundle } from "../src/lib/migration/adapters/wordpress-db/types";
import {
  computeEventScheduleResyncPlan,
  type EventScheduleResyncAction,
} from "../src/lib/migration/commit/event/computeEventScheduleResyncPlan";
import { resyncEventScheduleSessions } from "../src/lib/migration/commit/event/EventScheduleResyncWriter";
import { SearchIndexerService } from "../src/lib/search/SearchIndexerService";

const SOURCE_RECORD_KEY_PATTERN = /^wordpress-db:events:\d+$/;

export interface ProtectedFieldsSnapshot {
  status: string;
  cityId: string | null;
  venueCityId: string | null;
  slug: string | null;
  ownerUserId: string;
  title: string;
}

interface KeyResult {
  sourceRecordKey: string;
  activityId?: string;
  action: EventScheduleResyncAction | "ERROR";
  before?: ProtectedFieldsSnapshot;
  after?: ProtectedFieldsSnapshot;
  protectedFieldsUnchanged?: boolean;
  desiredSessionCount?: number;
  actualSessionCountBefore?: number;
  actualSessionCountAfter?: number;
  desiredFingerprint?: string;
  actualFingerprintBefore?: string;
  actualFingerprintAfter?: string;
  currentNextOccurrenceAt?: string | null;
  desiredNextOccurrenceAt?: string | null;
  blockedReason?: string;
  indexing?: "SKIPPED_NOT_PUBLISHED" | "OK" | "WARNING_NO_DOCUMENT";
  warnings: string[];
  committed: boolean;
  error?: string;
}

export interface Args {
  sourceRecordKeys: string[];
  preview: boolean;
  commit: boolean;
  allowRemoteReadonly: boolean;
  outPath?: string;
}

export function parseArgs(argv: readonly string[]): Args {
  const sourceRecordKeys: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--source-record-key") {
      const value = argv[i + 1];
      if (!value) throw new Error("Missing value for --source-record-key.");
      if (!SOURCE_RECORD_KEY_PATTERN.test(value)) {
        throw new Error(`Invalid --source-record-key "${value}". Expected "wordpress-db:events:{id}".`);
      }
      sourceRecordKeys.push(value);
    }
  }
  if (sourceRecordKeys.length === 0) {
    throw new Error("At least one --source-record-key wordpress-db:events:{id} is required.");
  }

  const preview = argv.includes("--preview");
  const commit = argv.includes("--commit");
  if (preview === commit) {
    throw new Error("Pass exactly one of --preview or --commit.");
  }

  const allowRemoteReadonly = argv.includes("--allow-remote-readonly");

  const outIndex = argv.indexOf("--out");
  const outPath = outIndex >= 0 ? argv[outIndex + 1] : undefined;
  if (outIndex >= 0 && !outPath) throw new Error("Missing value for --out.");

  return { sourceRecordKeys, preview, commit, allowRemoteReadonly, outPath };
}

async function readProtectedFields(
  prisma: PrismaClient,
  activityId: string,
): Promise<ProtectedFieldsSnapshot> {
  const activity = await prisma.activity.findUniqueOrThrow({
    where: { id: activityId },
    select: {
      status: true,
      cityId: true,
      slug: true,
      ownerUserId: true,
      title: true,
      venue: { select: { cityId: true } },
    },
  });
  return {
    status: activity.status,
    cityId: activity.cityId,
    venueCityId: activity.venue?.cityId ?? null,
    slug: activity.slug,
    ownerUserId: activity.ownerUserId,
    title: activity.title,
  };
}

export function protectedFieldsEqual(a: ProtectedFieldsSnapshot, b: ProtectedFieldsSnapshot): boolean {
  return (
    a.status === b.status &&
    a.cityId === b.cityId &&
    a.venueCityId === b.venueCityId &&
    a.slug === b.slug &&
    a.ownerUserId === b.ownerUserId &&
    a.title === b.title
  );
}

export function isSourceUnpublishedError(error: unknown): boolean {
  return error instanceof Error && /No published WordPress event found/.test(error.message);
}

function printKeyResult(result: KeyResult): void {
  console.log(`\n=== ${result.sourceRecordKey} ===`);
  console.log(`  action: ${result.action}`);
  if (result.activityId) console.log(`  activityId: ${result.activityId}`);
  if (result.blockedReason) console.log(`  blockedReason: ${result.blockedReason}`);
  if (result.desiredSessionCount !== undefined) {
    console.log(
      `  sessions: desired=${result.desiredSessionCount} actualBefore=${result.actualSessionCountBefore} actualAfter=${result.actualSessionCountAfter ?? "(no write)"}`,
    );
  }
  if (result.currentNextOccurrenceAt !== undefined) {
    console.log(`  nextOccurrenceAt: current=${result.currentNextOccurrenceAt} desired=${result.desiredNextOccurrenceAt}`);
  }
  if (result.desiredFingerprint) {
    console.log(`  fingerprint: desired=${result.desiredFingerprint}`);
    console.log(`  fingerprint: actualBefore=${result.actualFingerprintBefore} actualAfter=${result.actualFingerprintAfter ?? "(no write)"}`);
  }
  if (result.before) {
    console.log(`  protected before: ${JSON.stringify(result.before)}`);
  }
  if (result.after) {
    console.log(`  protected after:  ${JSON.stringify(result.after)}`);
    console.log(`  protected fields unchanged: ${result.protectedFieldsUnchanged}`);
  }
  if (result.indexing) console.log(`  indexing: ${result.indexing}`);
  if (result.warnings.length > 0) console.log(`  warnings: ${result.warnings.join(", ")}`);
  if (result.error) console.log(`  ERROR: ${result.error}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const wpConfig = readWordPressDbConfigFromEnv(process.env);
  assertRemoteAccessAllowed(wpConfig, args.allowRemoteReadonly);
  const executor = createWordPressSshMysqlExecutor(wpConfig);

  const prisma = new PrismaClient();
  const indexer = new SearchIndexerService(prisma);
  const results: KeyResult[] = [];
  let stoppedEarly = false;
  let resumeFromKey: string | undefined;

  try {
    for (let i = 0; i < args.sourceRecordKeys.length; i += 1) {
      const sourceRecordKey = args.sourceRecordKeys[i];
      const result: KeyResult = { sourceRecordKey, action: "ERROR", warnings: [], committed: false };

      try {
        // --- 1. Exact-key WP read (BLOCKED_EXPIRED_SOURCE if no longer published) ---
        let candidate;
        try {
          const envelope = await fetchPublishedEventEnvelopeBySourceRecordKey(executor, sourceRecordKey);
          const normalized = normalizeEvent(envelope.rawPayload as WordPressEventBundle, { now: new Date() });
          candidate = normalized.normalizedPayload;
          result.warnings.push(...normalized.warnings.map((w) => `${w.code}: ${w.message}`));
        } catch (error) {
          if (isSourceUnpublishedError(error)) {
            result.action = "BLOCKED_EXPIRED_SOURCE";
            result.blockedReason = error instanceof Error ? error.message : String(error);
            results.push(result);
            printKeyResult(result);
            continue;
          }
          throw error;
        }

        // --- 2. Exact lineage lookup — exactly one active row, CREATE forbidden ---
        const lineageRows = await prisma.migrationLineage.findMany({
          where: { sourceRecordKey, targetType: "ACTIVITY", isActive: true },
        });
        if (lineageRows.length === 0) {
          result.action = "BLOCKED_LINEAGE_MISSING";
          result.blockedReason = "No active MigrationLineage for this sourceRecordKey — resync never creates.";
          results.push(result);
          printKeyResult(result);
          continue;
        }
        if (lineageRows.length > 1 || !lineageRows[0].targetId?.trim()) {
          result.action = "BLOCKED_LINEAGE_AMBIGUOUS";
          result.blockedReason = `Expected exactly one active lineage with a targetId, found ${lineageRows.length}.`;
          results.push(result);
          printKeyResult(result);
          continue;
        }
        const activityId = lineageRows[0].targetId!;
        result.activityId = activityId;

        // --- 3. Fresh read of current state (protected snapshot + sessions) ---
        const before = await readProtectedFields(prisma, activityId);
        result.before = before;
        const currentSessions = await prisma.activitySession.findMany({
          where: { activityId },
          select: { startsAt: true },
        });

        // --- 4. Deterministic plan ---
        const scheduleDraftNullReason =
          !candidate.scheduleDraft && result.warnings.length > 0 ? result.warnings[result.warnings.length - 1] : undefined;
        const plan = computeEventScheduleResyncPlan({
          scheduleDraft: candidate.scheduleDraft,
          currentSessions,
          blockedReason: scheduleDraftNullReason,
        });
        result.action = plan.action;
        result.desiredSessionCount = plan.desiredSessionCount;
        result.actualSessionCountBefore = plan.actualSessionCount;
        result.desiredFingerprint = plan.desiredFingerprint;
        result.actualFingerprintBefore = plan.actualFingerprint;
        result.blockedReason = plan.blockedReason;
        result.currentNextOccurrenceAt =
          currentSessions.filter((s) => s.startsAt >= new Date()).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0]
            ?.startsAt.toISOString() ?? null;
        result.desiredNextOccurrenceAt = candidate.scheduleDraft
          ? candidate.scheduleDraft.dates
              .filter((d) => new Date(`${d}T00:00:00`) >= new Date(new Date().toDateString()))
              .sort()[0] ?? null
          : null;

        if (args.preview) {
          results.push(result);
          printKeyResult(result);
          continue;
        }

        // --- 5. Commit mode ---
        if (plan.action === "NOOP_ALREADY_SYNCED" || plan.action.startsWith("BLOCKED")) {
          results.push(result);
          printKeyResult(result);
          continue;
        }

        // Precondition re-check immediately before write: exactly one active
        // lineage still points at this Activity (guards against a race
        // between the read above and the write below in this sequential CLI).
        const recheck = await prisma.migrationLineage.findMany({
          where: { sourceRecordKey, targetType: "ACTIVITY", isActive: true },
        });
        if (recheck.length !== 1 || recheck[0].targetId !== activityId) {
          throw new Error(
            `Precondition failed immediately before write: lineage for ${sourceRecordKey} no longer resolves to exactly ${activityId}.`,
          );
        }

        const writeResult = await resyncEventScheduleSessions(prisma, {
          activityId,
          scheduleDraft: candidate.scheduleDraft!,
        });
        result.committed = true;

        const after = await readProtectedFields(prisma, activityId);
        result.after = after;
        result.protectedFieldsUnchanged = protectedFieldsEqual(before, after);
        if (!result.protectedFieldsUnchanged) {
          throw new Error(
            `POSTCONDITION FAILED for ${sourceRecordKey}: protected fields changed after a schedule-only resync. before=${JSON.stringify(before)} after=${JSON.stringify(after)}`,
          );
        }

        const afterSessions = await prisma.activitySession.findMany({
          where: { activityId },
          select: { startsAt: true },
        });
        result.actualSessionCountAfter = afterSessions.length;
        result.actualFingerprintAfter = computeEventScheduleResyncPlan({
          scheduleDraft: candidate.scheduleDraft,
          currentSessions: afterSessions,
        }).actualFingerprint;
        if (result.actualFingerprintAfter !== result.desiredFingerprint) {
          throw new Error(
            `POSTCONDITION FAILED for ${sourceRecordKey}: materialized sessions do not match desired fingerprint after write.`,
          );
        }

        if (after.status === "PUBLISHED") {
          await indexer.upsertActivity(activityId);
          const doc = await prisma.searchDocument.findFirst({
            where: { entityType: "activity", entityId: activityId },
          });
          result.indexing = doc ? "OK" : "WARNING_NO_DOCUMENT";
        } else {
          result.indexing = "SKIPPED_NOT_PUBLISHED";
        }

        void writeResult;
        results.push(result);
        printKeyResult(result);
      } catch (error) {
        result.action = "ERROR";
        result.error = error instanceof Error ? error.message : String(error);
        results.push(result);
        printKeyResult(result);
        stoppedEarly = true;
        resumeFromKey = sourceRecordKey;
        break;
      }
    }
  } finally {
    if (args.outPath) {
      writeFileSync(args.outPath, JSON.stringify({ mode: args.commit ? "commit" : "preview", results, stoppedEarly, resumeFromKey }, null, 2));
      console.log(`\nJSON report written to ${args.outPath}`);
    }
    await prisma.$disconnect();
  }

  console.log(`\n${args.commit ? "Commit" : "Preview"} summary: ${results.length}/${args.sourceRecordKeys.length} keys processed.`);
  if (stoppedEarly) {
    console.log(`STOPPED on first error. Resume point: ${resumeFromKey}`);
    process.exitCode = 1;
  }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error) => {
    console.error("migration-event-sessions-resync failed:", error);
    process.exitCode = 1;
  });
}
