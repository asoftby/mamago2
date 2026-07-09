import type { MigrationLineage, MigrationRecord, PrismaClient } from "@prisma/client";

import type { MigrationWarning } from "../../types";
import type { CommitOperation } from "../types";
import type { CreateLineageResult } from "../../lineage/types";
import type { ExecuteEventCommitResult } from "./EventCommitOrchestrator";
import type { EventCommitContext, NormalizedEventCandidate } from "./types";

/**
 * The narrowest slice of `EventCommitOrchestrator` this runner needs — one
 * method — so tests can inject a fake without constructing a real writer
 * chain underneath it.
 */
export interface EventCommitOrchestratorLike {
  execute(input: {
    operation: CommitOperation;
    candidate: NormalizedEventCandidate;
    context: EventCommitContext;
    targetActivityId?: string | null;
  }): Promise<ExecuteEventCommitResult>;
}

/** The narrowest slice of `MigrationLineageWriter` this runner needs. */
export interface MigrationLineageWriterLike {
  createLineage(input: {
    sourceId: string;
    sourceEntityType: string;
    sourceStableKey: string;
    sourceRecordKey: string;
    targetType: CommitOperation["targetType"];
    targetId: string;
    /** Set to the created `activityId` itself — `Activity` has no separate natural key (e.g. slug) at commit time; unlike Place/Media, there's nothing more meaningful to use yet. */
    targetStableKey?: string | null;
    lastSourceHash: string;
    runId?: string | null;
    recordId?: string | null;
  }): Promise<CreateLineageResult>;
}

export interface EventMediaSyncerLike {
  sync(input: {
    activityId: string;
    candidate: NormalizedEventCandidate;
    ownerUserId: string | null | undefined;
    sourceId: string;
    sourceHash: string | null;
    runId?: string | null;
    recordId?: string | null;
    sourceRecordKey: string;
  }): Promise<{ warnings: MigrationWarning[] }>;
}

/**
 * The narrowest slice of `PrismaClient` this runner needs — `update` only,
 * and only on `migrationRecord`. No `activity`/`activitySession`/
 * `eventVenue`/`activityImage`/`migrationLineage` delegates — those
 * already have their own dedicated writers (PR18, PR11) or don't belong
 * here at all. Mirrors `PlaceCommitRunnerPrismaClient` (PR12) exactly.
 */
export interface EventCommitRunnerPrismaClient {
  migrationRecord: Pick<PrismaClient["migrationRecord"], "update">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findFirst" | "update">;
}

export interface ExecuteEventCommitRunInput {
  operation: CommitOperation;
  record: MigrationRecord;
  candidate: NormalizedEventCandidate;
  context: EventCommitContext;
}

export interface ExecuteEventCommitRunResult {
  ok: boolean;
  activityId?: string;
  lineageId?: string;
  recordId: string;
  status: "LINKED" | "FAILED" | "BLOCKED";
  reasonCode?: string;
  error?: Error;
}

function describeOrchestratorFailure(
  result: ExecuteEventCommitResult,
): { code: string | null; message: string | null } {
  if (result.error) {
    return { code: result.reasonCode ?? null, message: result.error.message };
  }
  if (result.blockReasons && result.blockReasons.length > 0) {
    return {
      code: result.reasonCode ?? null,
      message: result.blockReasons.map((reason) => `${reason.code}: ${reason.message}`).join("; "),
    };
  }
  return {
    code: result.reasonCode ?? null,
    message: result.reasonCode ?? "Event commit failed for an unknown reason.",
  };
}

function isUpdateAction(action: CommitOperation["action"]): boolean {
  return action === "UPDATE";
}

function buildUpdateTargetMissingResult(recordId: string): ExecuteEventCommitRunResult {
  return {
    ok: false,
    recordId,
    status: "FAILED",
    reasonCode: "EVENT_UPDATE_TARGET_MISSING",
    error: new Error("Event UPDATE requires an existing MigrationLineage targetId."),
  };
}

/**
 * Wires PR17/PR18/PR19/PR11 into the first complete Event commit vertical:
 * `EventCommitOrchestrator.execute()` -> (on success) `MigrationLineageWriter
 * .createLineage()` -> `MigrationRecord.status` transition. No new Activity
 * creation logic lives here — this is sequencing and `MigrationRecord`
 * bookkeeping only. Mirrors `PlaceCommitRunner` (PR12) exactly, with
 * `targetType: "ACTIVITY"` in place of `"PLACE"`.
 *
 * `MigrationLineage` stays the single source of truth for `targetId` —
 * `MigrationRecord` is never given an `activityId` field to store one in
 * (it doesn't have one), and this runner never writes `planSummary`/
 * `normalizedPayload`/`rawPayload`, only `status`/`lastErrorCode`/
 * `lastErrorMessage`.
 *
 * There is no rollback here: if lineage recording fails after an Activity
 * was already created, the Activity is left in place and the record is
 * marked FAILED — undoing a partially-applied commit is a separate, later
 * concern, exactly like PR12.
 *
 * A `migrationRecord.update()` call throwing is treated as an
 * infrastructure error and is never caught here — it propagates as a raw
 * exception, not a typed result.
 */
export class EventCommitRunner {
  constructor(
    private readonly deps: {
      orchestrator: EventCommitOrchestratorLike;
      lineageWriter: MigrationLineageWriterLike;
      prisma: EventCommitRunnerPrismaClient;
      mediaSyncer?: EventMediaSyncerLike;
    },
  ) {}

  async execute(input: ExecuteEventCommitRunInput): Promise<ExecuteEventCommitRunResult> {
    const isUpdate = isUpdateAction(input.operation.action);
    const existingLineage: MigrationLineage | null = isUpdate
      ? await this.deps.prisma.migrationLineage.findFirst({
          where: {
            sourceId: input.record.sourceId,
            sourceRecordKey: input.record.sourceRecordKey,
            targetType: "ACTIVITY",
            isActive: true,
          },
        })
      : null;

    if (isUpdate && !existingLineage?.targetId?.trim()) {
      const missingTargetResult = buildUpdateTargetMissingResult(input.record.id);
      await this.deps.prisma.migrationRecord.update({
        where: { id: input.record.id },
        data: {
          status: "FAILED",
          lastErrorCode: missingTargetResult.reasonCode,
          lastErrorMessage: missingTargetResult.error?.message ?? null,
        },
      });
      return missingTargetResult;
    }

    const commitResult = await this.deps.orchestrator.execute({
      operation: input.operation,
      candidate: input.candidate,
      context: input.context,
      targetActivityId: isUpdate ? existingLineage!.targetId : null,
    });

    if (!commitResult.ok) {
      const failure = describeOrchestratorFailure(commitResult);
      await this.deps.prisma.migrationRecord.update({
        where: { id: input.record.id },
        data: {
          status: "FAILED",
          lastErrorCode: failure.code,
          lastErrorMessage: failure.message,
        },
      });

      return {
        ok: false,
        recordId: input.record.id,
        status: "FAILED",
        reasonCode: commitResult.reasonCode,
        error: commitResult.error,
      };
    }

    const mediaWarnings: MigrationWarning[] = [];
    if (this.deps.mediaSyncer && commitResult.activityId) {
      try {
        const mediaResult = await this.deps.mediaSyncer.sync({
          activityId: commitResult.activityId,
          candidate: input.candidate,
          ownerUserId: input.context.ownerUserId,
          sourceId: input.record.sourceId,
          sourceHash: input.record.sourceHash,
          runId: input.record.runId,
          recordId: input.record.id,
          sourceRecordKey: input.record.sourceRecordKey,
        });
        mediaWarnings.push(...mediaResult.warnings);
      } catch (error) {
        mediaWarnings.push({
          code: "EVENT_MEDIA_IMPORT_SKIPPED",
          message: "Event media sync failed unexpectedly; Activity commit remains linked.",
          severity: "WARNING",
          sourceRecordKey: input.record.sourceRecordKey,
          details: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    }

    let lineageResult: CreateLineageResult;
    try {
      if (isUpdate) {
        const updatedLineage = await this.deps.prisma.migrationLineage.update({
          where: { id: existingLineage!.id },
          data: {
            targetId: commitResult.activityId!,
            lastSourceHash: input.record.sourceHash!,
            runId: input.record.runId,
            recordId: input.record.id,
            isActive: true,
          },
        });
        lineageResult = {
          lineageId: updatedLineage.id,
          sourceRecordKey: updatedLineage.sourceRecordKey,
          targetType: updatedLineage.targetType,
          targetId: updatedLineage.targetId!,
        };
      } else {
        lineageResult = await this.deps.lineageWriter.createLineage({
          sourceId: input.record.sourceId,
          sourceEntityType: input.record.sourceEntityType,
          sourceStableKey: input.record.sourceStableKey,
          sourceRecordKey: input.record.sourceRecordKey,
          targetType: input.operation.targetType,
          targetId: commitResult.activityId!,
          targetStableKey: commitResult.activityId!,
          lastSourceHash: input.record.sourceHash!,
          runId: input.record.runId,
          recordId: input.record.id,
        });
      }
    } catch (error) {
      const lineageError = error instanceof Error ? error : new Error(String(error));

      // Activity already exists at this point — no rollback, only bookkeeping.
      await this.deps.prisma.migrationRecord.update({
        where: { id: input.record.id },
        data: {
          status: "FAILED",
          lastErrorCode: isUpdate ? "LINEAGE_UPDATE_FAILED" : "LINEAGE_WRITE_FAILED",
          lastErrorMessage: lineageError.message,
        },
      });

      return {
        ok: false,
        activityId: commitResult.activityId,
        recordId: input.record.id,
        status: "FAILED",
        reasonCode: isUpdate ? "LINEAGE_UPDATE_FAILED" : "LINEAGE_WRITE_FAILED",
        error: lineageError,
      };
    }

    const linkUpdateData: Record<string, unknown> = {
      status: "LINKED",
      lastErrorCode: null,
      lastErrorMessage: null,
    };
    if (mediaWarnings.length > 0) {
      const existing = (input.record.validationSummary as unknown) ?? null;
      const existingArr = Array.isArray(existing) ? (existing as MigrationWarning[]) : [];
      linkUpdateData.validationSummary = mergeWarnings(existingArr, mediaWarnings) as unknown as object;
    }

    await this.deps.prisma.migrationRecord.update({
      where: { id: input.record.id },
      data: linkUpdateData,
    });

    return {
      ok: true,
      activityId: commitResult.activityId,
      lineageId: lineageResult.lineageId,
      recordId: input.record.id,
      status: "LINKED",
    };
  }
}

function mergeWarnings(existing: readonly MigrationWarning[], extra: readonly MigrationWarning[]): MigrationWarning[] {
  const out: MigrationWarning[] = [...existing];
  const seen = new Set(existing.map((w) => `${w.code}::${w.message}`));
  for (const w of extra) {
    const key = `${w.code}::${w.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}
