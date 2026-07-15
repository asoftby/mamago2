import type { MigrationLineage, MigrationRecord, Place, PrismaClient } from "@prisma/client";

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
 * The narrowest slice of `PrismaClient` this runner needs. `place.findUnique`
 * was added alongside the conservative UPDATE-safety classification below —
 * it's a read-only lookup used to compare the target row's own `updatedAt`
 * against the lineage's `lastImportedAt`, never to write. No `article`/
 * `migrationReviewTask`/media/redirect delegates — those already have their
 * own dedicated writers (PR9, PR11) or don't exist yet.
 */
export interface PlaceCommitRunnerPrismaClient {
  migrationRecord: Pick<PrismaClient["migrationRecord"], "update">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findFirst" | "update">;
  place: Pick<PrismaClient["place"], "findUnique">;
}

/**
 * Why a UPDATE is refused, in machine-readable form — never includes
 * candidate/draft field values, only lineage/target identifiers, since this
 * can end up in `MigrationRecord.lastErrorMessage`.
 */
export type PlaceUpdateConflictReason =
  | "LINEAGE_MISSING"
  | "LINEAGE_MISMATCH"
  | "TARGET_ID_MISSING"
  | "TARGET_ROW_MISSING"
  | "LAST_IMPORTED_AT_UNKNOWN"
  | "TARGET_MODIFIED_AFTER_IMPORT";

type UpdateClassification =
  | { safe: true; lineage: MigrationLineage }
  | { safe: false; reason: PlaceUpdateConflictReason; targetId?: string };

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
  /** Only set when `reasonCode === "PLACE_UPDATE_CONFLICT"`. */
  conflictReason?: PlaceUpdateConflictReason;
  /** Identifiers only — sourceRecordKey/targetId, never candidate/draft data. */
  conflictDetails?: { sourceRecordKey: string; targetId?: string };
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

function describeConflict(input: {
  reason: PlaceUpdateConflictReason;
  sourceRecordKey: string;
  targetId?: string;
}): string {
  const targetPart = input.targetId ? ` targetId=${input.targetId}` : "";
  return (
    `Place UPDATE blocked (${input.reason}) for sourceRecordKey=${input.sourceRecordKey}` +
    `${targetPart}. Needs manual reconciliation — no automatic override exists.`
  );
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
 *
 * **UPDATE safety.** An active `MigrationLineage` row is never sufficient
 * on its own to allow an UPDATE — see `classifyUpdate()` below. Only a
 * lineage with a known `lastImportedAt` and a target row whose own
 * `updatedAt` is no later than that timestamp is `UPDATE_SAFE`; every other
 * case (`LINEAGE_MISSING`/`LINEAGE_MISMATCH`/`TARGET_ID_MISSING`/
 * `TARGET_ROW_MISSING`/`LAST_IMPORTED_AT_UNKNOWN`/
 * `TARGET_MODIFIED_AFTER_IMPORT`) is treated as `UPDATE_CONFLICT`: the
 * writer is never called, lineage is never touched, and the
 * `MigrationRecord` is marked `QUARANTINED` (not `FAILED` — this isn't an
 * error, it's a row that needs a human to look at it) with a
 * machine-readable `PLACE_UPDATE_CONFLICT` reason. There is deliberately no
 * override/force flag in this class — resolving a conflict is a separate,
 * explicit reconciliation action, not a flag on this runner.
 *
 * Timestamp comparison is strict (`target.updatedAt > lineage.lastImportedAt`),
 * no fudge-factor/buffer — any ambiguity (unknown `lastImportedAt`, missing
 * target row, mismatched lineage) is classified as a conflict rather than
 * guessed into safety.
 */
export class PlaceCommitRunner {
  constructor(
    private readonly deps: {
      orchestrator: PlaceCommitOrchestratorLike;
      lineageWriter: MigrationLineageWriterLike;
      prisma: PlaceCommitRunnerPrismaClient;
      now?: () => Date;
    },
  ) {}

  private now(): Date {
    return (this.deps.now ?? (() => new Date()))();
  }

  /**
   * Runs only for `action === "UPDATE"` — CREATE never reaches this. Never
   * writes anything; purely a read-and-decide step so `execute()` can
   * guarantee zero DB writes for a conflicted UPDATE.
   */
  private async classifyUpdate(input: ExecutePlaceCommitRunInput): Promise<UpdateClassification> {
    const lineage: MigrationLineage | null = await this.deps.prisma.migrationLineage.findFirst({
      where: {
        sourceId: input.record.sourceId,
        sourceRecordKey: input.record.sourceRecordKey,
        targetType: "PLACE",
        isActive: true,
      },
    });

    if (!lineage) {
      return { safe: false, reason: "LINEAGE_MISSING" };
    }
    // Defensive: never trust that the query's WHERE actually filtered
    // correctly (a fake Prisma client in tests, or a future refactor, could
    // hand back a row that doesn't belong to this record) — verify the key
    // fields match before ever using the lineage's targetId.
    if (lineage.sourceRecordKey !== input.record.sourceRecordKey || lineage.targetType !== "PLACE") {
      return { safe: false, reason: "LINEAGE_MISMATCH", targetId: lineage.targetId ?? undefined };
    }
    if (!lineage.targetId?.trim()) {
      return { safe: false, reason: "TARGET_ID_MISSING" };
    }

    const targetPlace: Place | null = await this.deps.prisma.place.findUnique({
      where: { id: lineage.targetId },
    });
    if (!targetPlace) {
      return { safe: false, reason: "TARGET_ROW_MISSING", targetId: lineage.targetId };
    }

    if (!lineage.lastImportedAt) {
      return { safe: false, reason: "LAST_IMPORTED_AT_UNKNOWN", targetId: lineage.targetId };
    }

    if (targetPlace.updatedAt.getTime() > lineage.lastImportedAt.getTime()) {
      return { safe: false, reason: "TARGET_MODIFIED_AFTER_IMPORT", targetId: lineage.targetId };
    }

    return { safe: true, lineage };
  }

  async execute(input: ExecutePlaceCommitRunInput): Promise<ExecutePlaceCommitRunResult> {
    const isUpdate = isUpdateAction(input.operation.action);

    let existingLineage: MigrationLineage | null = null;
    if (isUpdate) {
      const classification = await this.classifyUpdate(input);
      if (!classification.safe) {
        const conflictMessage = describeConflict({
          reason: classification.reason,
          sourceRecordKey: input.record.sourceRecordKey,
          targetId: classification.targetId,
        });
        await this.deps.prisma.migrationRecord.update({
          where: { id: input.record.id },
          data: {
            status: "QUARANTINED",
            lastErrorCode: "PLACE_UPDATE_CONFLICT",
            lastErrorMessage: conflictMessage,
          },
        });
        return {
          ok: false,
          recordId: input.record.id,
          status: "BLOCKED",
          reasonCode: "PLACE_UPDATE_CONFLICT",
          conflictReason: classification.reason,
          conflictDetails: { sourceRecordKey: input.record.sourceRecordKey, targetId: classification.targetId },
          error: new Error(conflictMessage),
        };
      }
      existingLineage = classification.lineage;
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
            lastImportedAt: this.now(),
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
