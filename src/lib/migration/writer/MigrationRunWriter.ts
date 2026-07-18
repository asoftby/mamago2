import { Prisma } from "@prisma/client";

import type {
  CreateRecordsFromPlanInput,
  CreateRunInput,
  FinishRunInput,
  MigrationRecord,
  MigrationRun,
  MigrationRunWriterPrismaClient,
  MigrationSource,
  PersistPlanInput,
  PersistPlanResult,
  UpsertSourceInput,
} from "./types";
import type { MigrationError, MigrationPlan, MigrationPlanItem, SourceRecordEnvelope } from "../types";

/**
 * Persists the *result of planning* (what the engine decided, not the
 * content itself) into the Migration ledger tables. This is bookkeeping,
 * not import: `rawPayload`/`normalizedPayload` are always written as
 * `null` — no WordPress HTML/postmeta ever reaches this file, let alone
 * mamaGo's DB. No Article/Place/Lineage/ReviewTask/Media/Redirect writes
 * happen here; the injected Prisma client type doesn't even expose those
 * delegates (see `MigrationRunWriterPrismaClient`).
 */
export class MigrationRunWriter {
  constructor(private readonly prisma: MigrationRunWriterPrismaClient) {}

  /**
   * Ensures a `MigrationSource` row exists for this adapter/namespace pair.
   * Ledger persistence, not seeding — the first `persistPlan()` call for a
   * new source is what creates it.
   */
  async upsertSource(input: UpsertSourceInput): Promise<MigrationSource> {
    return this.prisma.migrationSource.upsert({
      where: {
        adapterKey_sourceNamespace: {
          adapterKey: input.adapterKey,
          sourceNamespace: input.sourceNamespace,
        },
      },
      create: {
        adapterKey: input.adapterKey,
        sourceNamespace: input.sourceNamespace,
        name: input.sourceLabel ?? input.sourceNamespace,
      },
      update: input.sourceLabel !== undefined ? { name: input.sourceLabel } : {},
    });
  }

  async createRun(input: CreateRunInput): Promise<MigrationRun> {
    return this.prisma.migrationRun.create({
      data: {
        sourceId: input.sourceId,
        mode: input.mode,
        status: "RUNNING",
        adapterVersion: input.adapterVersion ?? "unknown",
        triggerType: input.triggerType,
        triggerUserId: input.triggerUserId,
        counters: statsToJson(input.stats),
        startedAt: new Date(),
      },
    });
  }

  /**
   * One `MigrationRecord` per `plan.items` entry. `sourceStableKey`/
   * `sourceHash`/`sourceUpdatedAt` come from the matching `plan.records`
   * envelope (by `sourceRecordKey`) — `MigrationPlanItem` itself doesn't
   * carry them. `rawPayload`/`normalizedPayload` are always `null`.
   */
  async createRecordsFromPlan(
    input: CreateRecordsFromPlanInput,
  ): Promise<readonly MigrationRecord[]> {
    const envelopeByKey = new Map<string, SourceRecordEnvelope>(
      input.plan.records.map((record) => [record.sourceRecordKey, record]),
    );
    const errorByKey = new Map<string, MigrationError>(
      input.plan.errors
        .filter((error) => error.sourceRecordKey !== undefined)
        .map((error) => [error.sourceRecordKey!, error]),
    );

    const operations = input.plan.items.map((item) =>
      this.prisma.migrationRecord.create({
        data: buildRecordCreateData(input.sourceId, input.runId, item, envelopeByKey, errorByKey),
      }),
    );

    if (this.prisma.$transaction) {
      return this.prisma.$transaction(operations);
    }
    return Promise.all(operations);
  }

  async finishRun(input: FinishRunInput): Promise<MigrationRun> {
    return this.prisma.migrationRun.update({
      where: { id: input.runId },
      data: {
        status: input.status,
        finishedAt: new Date(),
        counters: statsToJson(input.stats),
        errorMessage: input.errorMessage,
      },
    });
  }

  /**
   * upsertSource -> createRun -> createRecordsFromPlan -> finishRun. On a
   * `createRecordsFromPlan` failure, still calls `finishRun` (status
   * FAILED, with the error message) before re-throwing — a run is never
   * left dangling in RUNNING status.
   */
  async persistPlan(input: PersistPlanInput): Promise<PersistPlanResult> {
    const source = await this.upsertSource({
      adapterKey: input.adapterKey,
      sourceNamespace: input.sourceNamespace,
      sourceLabel: input.sourceLabel,
    });

    const run = await this.createRun({
      sourceId: source.id,
      mode: input.mode ?? "DRY_RUN",
      adapterVersion: input.adapterVersion ?? input.plan.adapterVersion,
      stats: input.plan.stats,
    });

    let records: readonly MigrationRecord[];
    try {
      records = await this.createRecordsFromPlan({
        sourceId: source.id,
        runId: run.id,
        plan: input.plan,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.finishRun({ runId: run.id, status: "FAILED", errorMessage: message });
      throw error;
    }

    await this.finishRun({ runId: run.id, status: "COMPLETED", stats: input.plan.stats });
    return { source, run, records };
  }
}

function statsToJson(stats: MigrationPlan["stats"] | undefined): object | undefined {
  if (!stats) return undefined;
  return JSON.parse(JSON.stringify(stats)) as object;
}

/**
 * Maps an engine `MigrationPlanItem` to a lightweight `MigrationRecord`
 * create payload. `status` collapses onto Prisma's `MigrationRecordStatus`
 * enum, which doesn't share the engine's SKIPPED/DUPLICATE/APPLIED/BOUND
 * vocabulary: FAIL maps to FAILED, preview-only UPDATE_CONFLICT maps to a
 * persisted QUARANTINED/QUARANTINE pair, and everything else (CREATE/
 * UPDATE/SKIP_UNCHANGED/SKIP_POLICY) maps to PLANNED — the precise
 * outcome is already captured by `planAction`.
 */
function buildRecordCreateData(
  sourceId: string,
  runId: string,
  item: MigrationPlanItem,
  envelopeByKey: ReadonlyMap<string, SourceRecordEnvelope>,
  errorByKey: ReadonlyMap<string, MigrationError>,
) {
  const envelope = envelopeByKey.get(item.sourceRecordKey);
  const error = errorByKey.get(item.sourceRecordKey);
  const planAction = item.action === "UPDATE_CONFLICT" ? "QUARANTINE" : item.action;
  const status =
    item.action === "FAIL" ? ("FAILED" as const) : item.action === "UPDATE_CONFLICT" ? ("QUARANTINED" as const) : ("PLANNED" as const);

  return {
    sourceId,
    runId,
    status,
    sourceEntityType: item.sourceEntityType,
    sourceStableKey: envelope?.sourceStableKey ?? item.sourceRecordKey,
    sourceRecordKey: item.sourceRecordKey,
    sourceExternalId: envelope?.sourceExternalId,
    sourceUrl: envelope?.sourceUrl,
    canonicalSourceUrl: envelope?.canonicalSourceUrl,
    sourceUpdatedAt: envelope?.sourceUpdatedAt ? new Date(envelope.sourceUpdatedAt) : undefined,
    sourceHash: envelope?.sourceHash,
    rawPayload: Prisma.JsonNull,
    normalizedPayload: Prisma.JsonNull,
    targetTypeHint: item.targetType,
    planAction,
    planSummary: item.summary ? (JSON.parse(JSON.stringify(item.summary)) as object) : undefined,
    validationSummary:
      item.warnings && item.warnings.length > 0
        ? (JSON.parse(JSON.stringify(item.warnings)) as object)
        : undefined,
    lastErrorCode: error?.code,
    lastErrorMessage: error?.message,
  };
}
