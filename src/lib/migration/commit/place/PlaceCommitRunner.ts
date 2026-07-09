import type { MigrationLineage, MigrationRecord, PrismaClient } from "@prisma/client";

import type { CommitOperation } from "../types";
import type { CreateLineageResult } from "../../lineage/types";
import type { ExecutePlaceCommitResult } from "./PlaceCommitOrchestrator";
import type { NormalizedPlaceCandidate, PlaceCommitContext } from "./types";

/**
 * The narrowest slice of `PlaceCommitOrchestrator` this runner needs — one
 * method — so tests can inject a fake without constructing a real writer
 * chain underneath it.
 */
export interface PlaceCommitOrchestratorLike {
  execute(input: {
    operation: CommitOperation;
    candidate: NormalizedPlaceCandidate;
    context: PlaceCommitContext;
    targetPlaceId?: string | null;
  }): Promise<ExecutePlaceCommitResult>;
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
    lastSourceHash: string;
    runId?: string | null;
    recordId?: string | null;
  }): Promise<CreateLineageResult>;
}

/**
 * The narrowest slice of `PrismaClient` this runner needs — `update` only,
 * and only on `migrationRecord`. No `article`/`place`/`migrationLineage`/
 * `migrationReviewTask`/media/redirect delegates — those already have
 * their own dedicated writers (PR9, PR11) or don't exist yet. This is the
 * first `migrationRecord.update()` in the project, but it doesn't warrant
 * its own one-method writer class — it's a single call used from exactly
 * one place, so it stays inline here with the same narrow-DI discipline
 * every other writer already follows.
 */
export interface PlaceCommitRunnerPrismaClient {
  migrationRecord: Pick<PrismaClient["migrationRecord"], "update">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findFirst" | "update">;
}

export interface ExecutePlaceCommitRunInput {
  operation: CommitOperation;
  record: MigrationRecord;
  candidate: NormalizedPlaceCandidate;
  context: PlaceCommitContext;
}

export interface ExecutePlaceCommitRunResult {
  ok: boolean;
  placeId?: string;
  lineageId?: string;
  recordId: string;
  status: "LINKED" | "FAILED" | "BLOCKED";
  reasonCode?: string;
  error?: Error;
}

function describeOrchestratorFailure(
  result: ExecutePlaceCommitResult,
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
    message: result.reasonCode ?? "Place commit failed for an unknown reason.",
  };
}

function isUpdateAction(action: CommitOperation["action"]): boolean {
  return action === "UPDATE";
}

function buildUpdateTargetMissingResult(recordId: string): ExecutePlaceCommitRunResult {
  return {
    ok: false,
    recordId,
    status: "FAILED",
    reasonCode: "PLACE_UPDATE_TARGET_MISSING",
    error: new Error("Place UPDATE requires an existing MigrationLineage targetId."),
  };
}

/**
 * Wires PR8.5/PR9/PR10/PR11 into the first complete Place commit vertical:
 * `PlaceCommitOrchestrator.execute()` -> (on success) `MigrationLineageWriter
 * .createLineage()` -> `MigrationRecord.status` transition. No new Place
 * creation logic lives here — this is sequencing and `MigrationRecord`
 * bookkeeping only.
 *
 * `MigrationLineage` stays the single source of truth for `targetId` —
 * `MigrationRecord` is never given a `placeId` field to store one in (it
 * doesn't have one), and this runner never writes `planSummary`/
 * `normalizedPayload`, only `status`/`lastErrorCode`/`lastErrorMessage`.
 *
 * There is no rollback here: if lineage recording fails after a Place was
 * already created, the Place is left in place (pun intended) and the
 * record is marked FAILED — undoing a partially-applied commit is a
 * separate, later concern (the rollback *plan* already exists as a data
 * structure since PR8; executing it does not exist yet).
 *
 * A `migrationRecord.update()` call throwing is treated as an
 * infrastructure error and is never caught here — it propagates as a raw
 * exception, not a typed result, exactly like every other unhandled
 * Prisma failure elsewhere in this project.
 */
export class PlaceCommitRunner {
  constructor(
    private readonly deps: {
      orchestrator: PlaceCommitOrchestratorLike;
      lineageWriter: MigrationLineageWriterLike;
      prisma: PlaceCommitRunnerPrismaClient;
    },
  ) {}

  async execute(input: ExecutePlaceCommitRunInput): Promise<ExecutePlaceCommitRunResult> {
    const isUpdate = isUpdateAction(input.operation.action);
    const existingLineage: MigrationLineage | null = isUpdate
      ? await this.deps.prisma.migrationLineage.findFirst({
          where: {
            sourceId: input.record.sourceId,
            sourceRecordKey: input.record.sourceRecordKey,
            targetType: "PLACE",
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
      targetPlaceId: existingLineage?.targetId ?? null,
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
      if (isUpdate) {
        const updatedLineage = await this.deps.prisma.migrationLineage.update({
          where: { id: existingLineage!.id },
          data: {
            targetId: commitResult.placeId!,
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
          targetId: commitResult.placeId!,
          lastSourceHash: input.record.sourceHash!,
          runId: input.record.runId,
          recordId: input.record.id,
        });
      }
    } catch (error) {
      const lineageError = error instanceof Error ? error : new Error(String(error));

      // Place already exists at this point — no rollback, only bookkeeping.
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
        placeId: commitResult.placeId,
        recordId: input.record.id,
        status: "FAILED",
        reasonCode: isUpdate ? "LINEAGE_UPDATE_FAILED" : "LINEAGE_WRITE_FAILED",
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
      placeId: commitResult.placeId,
      lineageId: lineageResult.lineageId,
      recordId: input.record.id,
      status: "LINKED",
    };
  }
}
