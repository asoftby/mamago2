import type { MigrationLineage, MigrationRecord, PrismaClient } from "@prisma/client";

import type { MigrationWarning } from "../../types";
import type { CommitOperation } from "../types";
import type { EventCreateTransactionClient, RunAtomicEventCreateResult } from "./runAtomicEventCreate";
import type { ExecuteEventCommitResult } from "./EventCommitOrchestrator";
import type { EventCommitContext, NormalizedEventCandidate } from "./types";

/**
 * The narrowest slice of `EventCommitOrchestrator` this runner needs — one
 * method — so tests can inject a fake without constructing a real writer
 * chain underneath it. Only used for UPDATE now — CREATE goes through the
 * atomic `runAtomicCreate` instead (see its own doc comment for why).
 */
export interface EventCommitOrchestratorLike {
  execute(input: {
    operation: CommitOperation;
    candidate: NormalizedEventCandidate;
    context: EventCommitContext;
    targetActivityId?: string | null;
  }): Promise<ExecuteEventCommitResult>;
}

/**
 * The narrowest slice of `runAtomicEventCreate` this runner needs — injected
 * as a function, not a class, so tests can fake the whole atomic-create
 * step (including "the transaction rolled back") without a real Prisma
 * transaction. The real wiring passes the actual `runAtomicEventCreate`
 * bound to nothing — `EventCommitRunner` itself calls it with the live `tx`
 * from `prisma.$transaction(...)`.
 */
export type RunAtomicEventCreateLike = (
  tx: EventCreateTransactionClient,
  input: {
    candidate: NormalizedEventCandidate;
    context: EventCommitContext;
    lineageInput: {
      sourceId: string;
      sourceEntityType: string;
      sourceStableKey: string;
      sourceRecordKey: string;
      targetType: CommitOperation["targetType"];
      lastSourceHash: string;
      runId?: string | null;
      recordId?: string | null;
    };
  },
) => Promise<RunAtomicEventCreateResult>;

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
 * The narrowest slice of `PrismaClient` this runner needs. `migrationRecord`/
 * `migrationLineage` cover UPDATE-path bookkeeping exactly as before — no
 * `activity`/`activitySession`/`eventVenue`/`activityImage` delegates, those
 * already have their own dedicated writers (PR18, PR11) or don't belong
 * here at all. `$transaction` is new — CREATE needs it to run
 * `runAtomicEventCreate` atomically; its callback type is intentionally the
 * narrow `EventCreateTransactionClient`, not Prisma's real
 * `Prisma.TransactionClient`, so fakes in tests don't need to satisfy
 * Prisma's full generated surface.
 */
export interface EventCommitRunnerPrismaClient {
  migrationRecord: Pick<PrismaClient["migrationRecord"], "update">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findFirst" | "update">;
  $transaction<T>(fn: (tx: EventCreateTransactionClient) => Promise<T>): Promise<T>;
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
 * Wires PR17/PR18/PR19/PR11 into the complete Event commit vertical.
 *
 * UPDATE: `EventCommitOrchestrator.execute()` -> (on success)
 * `MigrationLineage.update()` -> `MigrationRecord.status` transition —
 * unchanged from the original design. If lineage recording fails after an
 * Activity update already succeeded, the Activity is left in place and the
 * record is marked FAILED; a stale-but-still-linked Activity is recoverable
 * on retry, unlike a net-new orphan.
 *
 * CREATE: `Activity`/`ActivitySession`/`EventVenue`/`MigrationLineage` are
 * written atomically inside one `prisma.$transaction(...)` (see
 * `runAtomicEventCreate`). This exists specifically because
 * `MigrationLineage`'s exact-key unique constraint
 * (`sourceId`+`sourceRecordKey`+`targetType`+`targetRole`) can legitimately
 * conflict with a row an authorized rollback deactivated rather than
 * deleted — without atomicity, that lineage failure used to leave a fully
 * orphaned `Activity` (with sessions and venue) that no lineage tracked at
 * all. `MigrationLineageWriter` now reactivates a deactivated row in place
 * instead of failing outright, but the transaction stays as defense in
 * depth for every *other* way the lineage write can fail.
 *
 * `MigrationLineage` stays the single source of truth for `targetId` —
 * `MigrationRecord` is never given an `activityId` field to store one in
 * (it doesn't have one), and this runner never writes `planSummary`/
 * `normalizedPayload`/`rawPayload`, only `status`/`lastErrorCode`/
 * `lastErrorMessage`.
 *
 * A `migrationRecord.update()` call throwing is treated as an
 * infrastructure error and is never caught here — it propagates as a raw
 * exception, not a typed result.
 */
export class EventCommitRunner {
  constructor(
    private readonly deps: {
      orchestrator: EventCommitOrchestratorLike;
      runAtomicCreate: RunAtomicEventCreateLike;
      prisma: EventCommitRunnerPrismaClient;
      mediaSyncer?: EventMediaSyncerLike;
    },
  ) {}

  async execute(input: ExecuteEventCommitRunInput): Promise<ExecuteEventCommitRunResult> {
    if (isUpdateAction(input.operation.action)) {
      return this.executeUpdate(input);
    }
    return this.executeCreate(input);
  }

  private async executeUpdate(input: ExecuteEventCommitRunInput): Promise<ExecuteEventCommitRunResult> {
    const existingLineage: MigrationLineage | null = await this.deps.prisma.migrationLineage.findFirst({
      where: {
        sourceId: input.record.sourceId,
        sourceRecordKey: input.record.sourceRecordKey,
        targetType: "ACTIVITY",
        isActive: true,
      },
    });

    if (!existingLineage?.targetId?.trim()) {
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
      targetActivityId: existingLineage.targetId,
    });

    if (!commitResult.ok) {
      const failure = describeOrchestratorFailure(commitResult);
      await this.deps.prisma.migrationRecord.update({
        where: { id: input.record.id },
        data: { status: "FAILED", lastErrorCode: failure.code, lastErrorMessage: failure.message },
      });
      return {
        ok: false,
        recordId: input.record.id,
        status: "FAILED",
        reasonCode: commitResult.reasonCode,
        error: commitResult.error,
      };
    }

    const mediaWarnings = await this.syncMediaBestEffort(input, commitResult.activityId!);

    let lineageId: string;
    try {
      const updatedLineage = await this.deps.prisma.migrationLineage.update({
        where: { id: existingLineage.id },
        data: {
          targetId: commitResult.activityId!,
          lastSourceHash: input.record.sourceHash!,
          runId: input.record.runId,
          recordId: input.record.id,
          isActive: true,
        },
      });
      lineageId = updatedLineage.id;
    } catch (error) {
      const lineageError = error instanceof Error ? error : new Error(String(error));
      // Activity already exists/was updated at this point — no rollback, only bookkeeping.
      await this.deps.prisma.migrationRecord.update({
        where: { id: input.record.id },
        data: { status: "FAILED", lastErrorCode: "LINEAGE_UPDATE_FAILED", lastErrorMessage: lineageError.message },
      });
      return {
        ok: false,
        activityId: commitResult.activityId,
        recordId: input.record.id,
        status: "FAILED",
        reasonCode: "LINEAGE_UPDATE_FAILED",
        error: lineageError,
      };
    }

    await this.finalizeLinked(input, mediaWarnings);

    return {
      ok: true,
      activityId: commitResult.activityId,
      lineageId,
      recordId: input.record.id,
      status: "LINKED",
    };
  }

  private async executeCreate(input: ExecuteEventCommitRunInput): Promise<ExecuteEventCommitRunResult> {
    let atomicResult: RunAtomicEventCreateResult;
    try {
      atomicResult = await this.deps.prisma.$transaction((tx) =>
        this.deps.runAtomicCreate(tx, {
          candidate: input.candidate,
          context: input.context,
          lineageInput: {
            sourceId: input.record.sourceId,
            sourceEntityType: input.record.sourceEntityType,
            sourceStableKey: input.record.sourceStableKey,
            sourceRecordKey: input.record.sourceRecordKey,
            targetType: input.operation.targetType,
            lastSourceHash: input.record.sourceHash!,
            runId: input.record.runId,
            recordId: input.record.id,
          },
        }),
      );
    } catch (error) {
      // The whole transaction rolled back — Activity/ActivitySession/EventVenue
      // were never committed, nothing is orphaned. Bookkeeping only, same as
      // every other FAILED path here.
      const writeError = error instanceof Error ? error : new Error(String(error));
      await this.deps.prisma.migrationRecord.update({
        where: { id: input.record.id },
        data: { status: "FAILED", lastErrorCode: "EVENT_CREATE_TRANSACTION_FAILED", lastErrorMessage: writeError.message },
      });
      return {
        ok: false,
        recordId: input.record.id,
        status: "FAILED",
        reasonCode: "EVENT_CREATE_TRANSACTION_FAILED",
        error: writeError,
      };
    }

    if (!atomicResult.ok) {
      // Draft was blocked before anything was written — nothing to roll back.
      const message = atomicResult.blockReasons.map((reason) => `${reason.code}: ${reason.message}`).join("; ");
      await this.deps.prisma.migrationRecord.update({
        where: { id: input.record.id },
        data: { status: "FAILED", lastErrorCode: atomicResult.reasonCode, lastErrorMessage: message },
      });
      return {
        ok: false,
        recordId: input.record.id,
        status: "FAILED",
        reasonCode: atomicResult.reasonCode,
        error: new Error(message),
      };
    }

    const { activityId, lineageResult } = atomicResult;
    const mediaWarnings = await this.syncMediaBestEffort(input, activityId);
    await this.finalizeLinked(input, mediaWarnings);

    return {
      ok: true,
      activityId,
      lineageId: lineageResult.lineageId,
      recordId: input.record.id,
      status: "LINKED",
    };
  }

  /** Network I/O, never part of any DB transaction — a media failure is a warning, never a blocker, exactly as before. */
  private async syncMediaBestEffort(
    input: ExecuteEventCommitRunInput,
    activityId: string,
  ): Promise<MigrationWarning[]> {
    if (!this.deps.mediaSyncer) return [];
    try {
      const mediaResult = await this.deps.mediaSyncer.sync({
        activityId,
        candidate: input.candidate,
        ownerUserId: input.context.ownerUserId,
        sourceId: input.record.sourceId,
        sourceHash: input.record.sourceHash,
        runId: input.record.runId,
        recordId: input.record.id,
        sourceRecordKey: input.record.sourceRecordKey,
      });
      return mediaResult.warnings;
    } catch (error) {
      return [
        {
          code: "EVENT_MEDIA_IMPORT_SKIPPED",
          message: "Event media sync failed unexpectedly; Activity commit remains linked.",
          severity: "WARNING",
          sourceRecordKey: input.record.sourceRecordKey,
          details: { error: error instanceof Error ? error.message : String(error) },
        },
      ];
    }
  }

  private async finalizeLinked(input: ExecuteEventCommitRunInput, mediaWarnings: MigrationWarning[]): Promise<void> {
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
