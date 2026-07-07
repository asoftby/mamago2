import type { MigrationRecord, PrismaClient } from "@prisma/client";

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

/**
 * The narrowest slice of `PrismaClient` this runner needs — `update` only,
 * and only on `migrationRecord`. No `activity`/`activitySession`/
 * `eventVenue`/`activityImage`/`migrationLineage` delegates — those
 * already have their own dedicated writers (PR18, PR11) or don't belong
 * here at all. Mirrors `PlaceCommitRunnerPrismaClient` (PR12) exactly.
 */
export interface EventCommitRunnerPrismaClient {
  migrationRecord: Pick<PrismaClient["migrationRecord"], "update">;
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
    },
  ) {}

  async execute(input: ExecuteEventCommitRunInput): Promise<ExecuteEventCommitRunResult> {
    const commitResult = await this.deps.orchestrator.execute({
      operation: input.operation,
      candidate: input.candidate,
      context: input.context,
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

    let lineageResult: CreateLineageResult;
    try {
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
    } catch (error) {
      const lineageError = error instanceof Error ? error : new Error(String(error));

      // Activity already exists at this point — no rollback, only bookkeeping.
      await this.deps.prisma.migrationRecord.update({
        where: { id: input.record.id },
        data: {
          status: "FAILED",
          lastErrorCode: "LINEAGE_WRITE_FAILED",
          lastErrorMessage: lineageError.message,
        },
      });

      return {
        ok: false,
        activityId: commitResult.activityId,
        recordId: input.record.id,
        status: "FAILED",
        reasonCode: "LINEAGE_WRITE_FAILED",
        error: lineageError,
      };
    }

    await this.deps.prisma.migrationRecord.update({
      where: { id: input.record.id },
      data: {
        status: "LINKED",
        lastErrorCode: null,
        lastErrorMessage: null,
      },
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
