import type { MigrationLineage, MigrationRecord, PrismaClient } from "@prisma/client";

import type { CommitOperation } from "../types";
import type { CreateLineageResult } from "../../lineage/types";
import type { ExecuteRouteCommitResult } from "./RouteCommitOrchestrator";
import type { MigrationWarning } from "../../types";
import type { NormalizedRouteCandidate, RouteCommitContext } from "./buildRouteCreateDraft";

export interface RouteCommitOrchestratorLike {
  execute(input: {
    operation: CommitOperation;
    candidate: NormalizedRouteCandidate;
    context: RouteCommitContext;
    targetRouteId?: string | null;
  }): Promise<ExecuteRouteCommitResult>;
}

export interface MigrationLineageWriterLike {
  createLineage(input: {
    sourceId: string;
    sourceEntityType: string;
    sourceStableKey: string;
    sourceRecordKey: string;
    targetType: "ROUTE";
    targetId: string;
    targetStableKey?: string | null;
    lastSourceHash: string;
    runId?: string | null;
    recordId?: string | null;
  }): Promise<CreateLineageResult>;
}

export interface RouteCommitRunnerPrismaClient {
  migrationRecord: Pick<PrismaClient["migrationRecord"], "update">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findFirst" | "update">;
}

export interface ExecuteRouteCommitRunInput {
  operation: CommitOperation;
  record: MigrationRecord;
  candidate: NormalizedRouteCandidate;
  context: RouteCommitContext;
}

export interface ExecuteRouteCommitRunResult {
  ok: boolean;
  routeId?: string;
  lineageId?: string;
  recordId: string;
  status: "LINKED" | "FAILED" | "BLOCKED";
  reasonCode?: string;
  error?: Error;
}

function describeOrchestratorFailure(
  result: ExecuteRouteCommitResult,
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
    message: result.reasonCode ?? "Route commit failed for an unknown reason.",
  };
}

function isUpdateAction(action: CommitOperation["action"]): boolean {
  return action === "UPDATE";
}

function buildUpdateTargetMissingResult(recordId: string): ExecuteRouteCommitRunResult {
  return {
    ok: false,
    recordId,
    status: "FAILED",
    reasonCode: "ROUTE_UPDATE_TARGET_MISSING",
    error: new Error("Route UPDATE requires an existing MigrationLineage targetId."),
  };
}

export class RouteCommitRunner {
  constructor(
    private readonly deps: {
      orchestrator: RouteCommitOrchestratorLike;
      lineageWriter: MigrationLineageWriterLike;
      prisma: RouteCommitRunnerPrismaClient;
    },
  ) {}

  async execute(input: ExecuteRouteCommitRunInput): Promise<ExecuteRouteCommitRunResult> {
    const isUpdate = isUpdateAction(input.operation.action);
    const existingLineage: MigrationLineage | null = isUpdate
      ? await this.deps.prisma.migrationLineage.findFirst({
          where: {
            sourceId: input.record.sourceId,
            sourceRecordKey: input.record.sourceRecordKey,
            targetType: "ROUTE",
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
      targetRouteId: isUpdate ? existingLineage!.targetId : null,
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
            targetId: commitResult.routeId!,
            targetNaturalKey: commitResult.routeId!,
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
          targetType: "ROUTE",
          targetId: commitResult.routeId!,
          targetStableKey: commitResult.routeId!,
          lastSourceHash: input.record.sourceHash!,
          runId: input.record.runId,
          recordId: input.record.id,
        });
      }
    } catch (error) {
      const lineageError = error instanceof Error ? error : new Error(String(error));
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
        routeId: commitResult.routeId,
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
    if (commitResult.warnings && commitResult.warnings.length > 0) {
      const existing = (input.record.validationSummary as unknown) ?? null;
      const existingArr = Array.isArray(existing) ? (existing as MigrationWarning[]) : [];
      linkUpdateData.validationSummary = mergeWarnings(existingArr, commitResult.warnings) as unknown as object;
    }

    await this.deps.prisma.migrationRecord.update({
      where: { id: input.record.id },
      data: linkUpdateData,
    });

    return {
      ok: true,
      routeId: commitResult.routeId,
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
