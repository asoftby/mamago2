import type { MigrationLineage, MigrationRecord, PrismaClient } from "@prisma/client";

import type { CommitOperation } from "../types";
import type { CreateLineageResult } from "../../lineage/types";
import { classifyImportedTargetUpdateSafety } from "../shared/classifyImportedTargetUpdateSafety";
import type { ExecuteArticleCommitResult } from "./ArticleCommitOrchestrator";
import type { ArticleCommitContext, NormalizedArticleCandidate } from "./buildArticleCreateDraft";
import type { MigrationWarning } from "../../types";

/**
 * The narrowest slice of `ArticleCommitOrchestrator` this runner needs —
 * one method — so tests can inject a fake without constructing a real
 * writer chain underneath it.
 */
export interface ArticleCommitOrchestratorLike {
  execute(input: {
    candidate: NormalizedArticleCandidate;
    context: ArticleCommitContext;
    action?: "CREATE" | "UPDATE";
    targetArticleId?: string | null;
  }): Promise<ExecuteArticleCommitResult>;
}

/**
 * The narrowest slice of `MigrationLineageWriter` this runner needs.
 * `sourceId`/`sourceEntityType`/`sourceStableKey`/`sourceRecordKey` are
 * the real, required `CreateLineageInput` fields (verified against
 * `src/lib/migration/lineage/types.ts` before writing this file) — the
 * PR24 prompt's sketch used a field called `sourceType`, which doesn't
 * exist anywhere on `CreateLineageInput`; the real field is
 * `sourceEntityType`, used here instead.
 */
export interface MigrationLineageWriterLike {
  createLineage(input: {
    sourceId: string;
    sourceEntityType: string;
    sourceStableKey: string;
    sourceRecordKey: string;
    targetType: "ARTICLE";
    targetId: string;
    targetStableKey?: string | null;
    lastSourceHash: string;
    runId?: string | null;
    recordId?: string | null;
  }): Promise<CreateLineageResult>;
}

/**
 * The narrowest slice of `PrismaClient` this runner needs — `update`
 * only, and only on `migrationRecord`. No `article`/`articleSlugHistory`/
 * `mediaAsset`/`migrationLineage` delegates. Mirrors
 * `EventCommitRunnerPrismaClient` (PR20) exactly.
 */
export interface ArticleCommitRunnerPrismaClient {
  migrationRecord: Pick<PrismaClient["migrationRecord"], "update">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findFirst" | "update">;
  article: Pick<PrismaClient["article"], "findUnique">;
}

export interface ExecuteArticleCommitRunInput {
  operation: CommitOperation;
  candidate: NormalizedArticleCandidate;
  context: ArticleCommitContext;
  migrationRecord: MigrationRecord;
}

export interface ExecuteArticleCommitRunResult {
  ok: boolean;
  articleId?: string;
  lineageId?: string;
  recordId: string;
  status: "LINKED" | "FAILED";
  errorCode?: string;
  errorMessage?: string;
}

function describeBlockedDraft(result: ExecuteArticleCommitResult): string {
  const reasons = result.blockReasons ?? [];
  if (reasons.length === 0) {
    return "Article draft was blocked for an unknown reason.";
  }
  return reasons.map((reason) => `${reason.code}: ${reason.message}`).join("; ");
}

function isUpdateAction(action: CommitOperation["action"]): boolean {
  return action === "UPDATE";
}

function buildUpdateTargetMissingResult(recordId: string): ExecuteArticleCommitRunResult {
  return {
    ok: false,
    recordId,
    status: "FAILED",
    errorCode: "ARTICLE_UPDATE_TARGET_MISSING",
    errorMessage: "Article UPDATE requires an existing MigrationLineage targetId.",
  };
}

/**
 * Wires PR21/22/23/11 into the first complete Article commit vertical:
 * `ArticleCommitOrchestrator.execute()` -> (on success)
 * `MigrationLineageWriter.createLineage()` -> `MigrationRecord.status`
 * transition. No new Article creation logic lives here — this is
 * sequencing and `MigrationRecord` bookkeeping only, mirroring
 * `EventCommitRunner` (PR20).
 *
 * Unlike `EventCommitRunner`, the orchestrator here never throws — PR23's
 * `ArticleCommitOrchestrator` already returns a typed
 * `ExecuteArticleCommitResult` for both the `BLOCKED` and `FAILED` cases,
 * so there's no try/catch around the orchestrator call, just a branch on
 * `commitResult.ok`/`commitResult.status`. A blocked draft is recorded
 * with `lastErrorCode: "ARTICLE_BLOCKED"`; an actual writer failure keeps
 * whatever `errorCode` the writer produced (e.g.
 * `"ARTICLE_CREATE_FAILED"`). `errorCode`/`errorMessage` stay plain
 * strings throughout this runner's result, not `Error` objects — matching
 * the typed-result chain PR22/PR23 already established, rather than
 * mixing string errors with thrown-`Error` errors the way
 * `PlaceCommitRunner`/`EventCommitRunner` do.
 *
 * `MigrationLineage` stays the single source of truth for `targetId` —
 * `MigrationRecord` is never given an `articleId` field to store one in
 * (it doesn't have one), and this runner never writes `planSummary`/
 * `normalizedPayload`/`rawPayload`, only `status`/`lastErrorCode`/
 * `lastErrorMessage`.
 *
 * There is no rollback here: if lineage recording fails after an Article
 * was already created, the Article is left in place and the record is
 * marked FAILED — exactly like PR12/PR20.
 *
 * `migrationRecord.update()` calls are never wrapped in try/catch — a
 * throw there propagates raw, same as `EventCommitRunner`.
 *
 * Draft `warnings` (e.g. `CONTENT_CONVERTED_LOSSY`) are deliberately not
 * exposed on this runner's result: nothing downstream reads them yet (no
 * `MigrationRecord` column stores warnings, and there's no review-task
 * consumer in this PR), so adding a field for them now would be
 * speculative. They remain available on `ArticleCommitOrchestrator`'s own
 * result for whoever wires that up next.
 */
export interface ArticleFullMediaSyncerLike {
  sync(input: {
    articleId: string;
    candidate: NormalizedArticleCandidate;
    ownerUserId: string | null | undefined;
    sourceId: string;
    sourceHash: string | null;
    runId?: string | null;
    recordId?: string | null;
    sourceRecordKey: string;
  }): Promise<{ warnings: MigrationWarning[] }>;
}

export class ArticleCommitRunner {
  constructor(
    private readonly deps: {
      orchestrator: ArticleCommitOrchestratorLike;
      lineageWriter: MigrationLineageWriterLike;
      prisma: ArticleCommitRunnerPrismaClient;
      mediaSyncer?: ArticleFullMediaSyncerLike;
      now?: () => Date;
    },
  ) {}

  private now(): Date {
    return (this.deps.now ?? (() => new Date()))();
  }

  async execute(input: ExecuteArticleCommitRunInput): Promise<ExecuteArticleCommitRunResult> {
    const { migrationRecord, operation } = input;
    const isUpdate = isUpdateAction(operation.action);
    const existingLineage: MigrationLineage | null = isUpdate
      ? await this.deps.prisma.migrationLineage.findFirst({
          where: {
            sourceId: migrationRecord.sourceId,
            sourceRecordKey: migrationRecord.sourceRecordKey,
            targetType: "ARTICLE",
            isActive: true,
          },
        })
      : null;

    if (isUpdate && !existingLineage?.targetId?.trim()) {
      const missingTargetResult = buildUpdateTargetMissingResult(migrationRecord.id);
      await this.deps.prisma.migrationRecord.update({
        where: { id: migrationRecord.id },
        data: {
          status: "FAILED",
          lastErrorCode: missingTargetResult.errorCode,
          lastErrorMessage: missingTargetResult.errorMessage,
        },
      });
      return missingTargetResult;
    }

    if (isUpdate && existingLineage?.targetId) {
      const article = await this.deps.prisma.article.findUnique({
        where: { id: existingLineage.targetId },
        select: { id: true, updatedAt: true },
      });
      const safety = classifyImportedTargetUpdateSafety({
        targetType: "ARTICLE",
        sourceRecordKey: migrationRecord.sourceRecordKey,
        lineage: existingLineage,
        target: article,
      });
      if (safety.classification === "UPDATE_CONFLICT") {
        await this.deps.prisma.migrationRecord.update({
          where: { id: migrationRecord.id },
          data: {
            status: "QUARANTINED",
            lastErrorCode: "ARTICLE_UPDATE_CONFLICT",
            lastErrorMessage: safety.reason,
          },
        });
        return {
          ok: false,
          recordId: migrationRecord.id,
          status: "FAILED",
          errorCode: "ARTICLE_UPDATE_CONFLICT",
          errorMessage: `Article UPDATE refused: ${safety.reason}.`,
        };
      }
    }

    const commitResult = await this.deps.orchestrator.execute({
      candidate: input.candidate,
      context: input.context,
      action: isUpdate ? "UPDATE" : "CREATE",
      targetArticleId: existingLineage?.targetId ?? null,
    });

    if (!commitResult.ok) {
      const isBlocked = commitResult.status === "BLOCKED";
      const errorCode = isBlocked ? "ARTICLE_BLOCKED" : commitResult.errorCode;
      const errorMessage = isBlocked ? describeBlockedDraft(commitResult) : commitResult.errorMessage;

      await this.deps.prisma.migrationRecord.update({
        where: { id: migrationRecord.id },
        data: {
          status: "FAILED",
          lastErrorCode: errorCode ?? null,
          lastErrorMessage: errorMessage ?? null,
        },
      });

      return {
        ok: false,
        recordId: migrationRecord.id,
        status: "FAILED",
        errorCode,
        errorMessage,
      };
    }

    let lineageResult: CreateLineageResult;
    try {
      if (isUpdate) {
        const updatedLineage = await this.deps.prisma.migrationLineage.update({
          where: { id: existingLineage!.id },
          data: {
            targetId: commitResult.articleId!,
            targetNaturalKey: commitResult.articleId!,
            lastSourceHash: migrationRecord.sourceHash!,
            runId: migrationRecord.runId,
            recordId: migrationRecord.id,
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
          sourceId: migrationRecord.sourceId,
          sourceEntityType: migrationRecord.sourceEntityType,
          sourceStableKey: migrationRecord.sourceStableKey,
          sourceRecordKey: migrationRecord.sourceRecordKey,
          targetType: "ARTICLE",
          targetId: commitResult.articleId!,
          targetStableKey: commitResult.articleId!,
          lastSourceHash: migrationRecord.sourceHash!,
          runId: migrationRecord.runId,
          recordId: migrationRecord.id,
        });
      }
    } catch (error) {
      const lineageError = error instanceof Error ? error : new Error(String(error));
      const errorCode = isUpdate ? "LINEAGE_UPDATE_FAILED" : "LINEAGE_WRITE_FAILED";

      // Article already exists at this point — no rollback, only bookkeeping.
      await this.deps.prisma.migrationRecord.update({
        where: { id: migrationRecord.id },
        data: {
          status: "FAILED",
          lastErrorCode: errorCode,
          lastErrorMessage: lineageError.message,
        },
      });

      return {
        ok: false,
        articleId: commitResult.articleId,
        recordId: migrationRecord.id,
        status: "FAILED",
        errorCode,
        errorMessage: lineageError.message,
      };
    }

    if (this.deps.mediaSyncer && commitResult.articleId) {
      try {
        await this.deps.mediaSyncer.sync({
          articleId: commitResult.articleId,
          candidate: input.candidate,
          ownerUserId: input.context.authorUserId,
          sourceId: migrationRecord.sourceId,
          sourceHash: migrationRecord.sourceHash,
          runId: migrationRecord.runId,
          recordId: migrationRecord.id,
          sourceRecordKey: migrationRecord.sourceRecordKey,
        });
      } catch {
        // Best-effort: one broken image must not abort the Article commit.
      }
    }

    await this.deps.prisma.migrationRecord.update({
      where: { id: migrationRecord.id },
      data: {
        status: "LINKED",
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });

    return {
      ok: true,
      articleId: commitResult.articleId,
      lineageId: lineageResult.lineageId,
      recordId: migrationRecord.id,
      status: "LINKED",
    };
  }
}
