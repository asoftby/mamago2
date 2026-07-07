import type { MigrationRecord, PrismaClient } from "@prisma/client";

import type { MigrationRunExecutionPlan } from "../../core/orchestrator";
import type { PersistPlanInput, PersistPlanResult } from "../../writer/types";
import { resolveCommitContextForExecutionCandidate } from "../context/resolveCommitContextConfig";
import type { MigrationCommitContextConfig } from "../context/resolveCommitContextConfig";
import { dispatchCommitRunner } from "../dispatch/dispatchCommitRunner";
import type {
  ArticleCommitRunnerLike,
  EventCommitRunnerLike,
  PlaceCommitRunnerLike,
} from "../dispatch/dispatchCommitRunner";

/**
 * The narrowest slice of `MigrationRunWriter` this harness needs — one
 * method. Never the concrete class, so a fake test double is enough; the
 * real `MigrationRunWriter` (PR7) satisfies this unchanged.
 */
export interface CommitRunWriterLike {
  persistPlan(input: PersistPlanInput): Promise<PersistPlanResult>;
}

/**
 * `migrationRecord.update` only. Needed alongside `runWriter` because the
 * "context resolution failed" path (below) marks a record `FAILED` before
 * `dispatchCommitRunner()` is ever reached — none of the injected
 * Runners touch a record they were never called for, so this harness must
 * be able to update it itself. Not present in the PR28 prompt's literal
 * `runCommitExecutionPlan({executionPlan, contextConfig, runWriter,
 * runners})` sketch, but required by the prompt's own "ВАЖНО" note
 * ("MigrationRecord.update должен оставаться injected через ... prisma
 * interface, не singleton") — added as an explicit extra constructor
 * input, not a singleton import.
 */
export interface RunCommitExecutionPlanPrismaClient {
  migrationRecord: Pick<PrismaClient["migrationRecord"], "update">;
}

export interface RunCommitExecutionPlanInput {
  executionPlan: MigrationRunExecutionPlan;
  contextConfig: MigrationCommitContextConfig;
  runWriter: CommitRunWriterLike;
  prisma: RunCommitExecutionPlanPrismaClient;
  runners: {
    place?: PlaceCommitRunnerLike;
    event?: EventCommitRunnerLike;
    article?: ArticleCommitRunnerLike;
  };
}

export type RunCommitExecutionPlanOutcome = "LINKED" | "FAILED";

export interface RunCommitExecutionPlanCandidateResult {
  sourceRecordKey: string;
  recordId?: string;
  outcome: RunCommitExecutionPlanOutcome;
  targetId?: string;
  lineageId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface RunCommitExecutionPlanSummary {
  total: number;
  linked: number;
  failed: number;
  results: readonly RunCommitExecutionPlanCandidateResult[];
}

/**
 * Wires PR7 (`MigrationRunWriter.persistPlan`), PR25 (execution plan),
 * PR26 (context resolver), and PR27 (dispatcher) into the first thing
 * that can actually run a commit end to end — still nothing runs on its
 * own: no CLI, no auto-invocation, no production defaults.
 * `runWriter`/`prisma`/`runners` are all constructor-injected; nothing
 * here imports a concrete Runner class or the Prisma singleton.
 *
 * Flow, per `executionCandidate`, in `executionCandidates` order:
 * 1. `persistPlan(executionPlan.plan)` once, up front, via `runWriter`.
 * 2. Match each `executionCandidate.planItem.sourceRecordKey` to the
 *    persisted `MigrationRecord` `persistPlan()` actually returned (its
 *    real result shape already includes `records` directly — see
 *    `PersistPlanResult` in `writer/types.ts` — nothing is re-fetched).
 *    No match -> `FAILED` with `MISSING_MIGRATION_RECORD`, no update
 *    attempted (there's no `id` to update).
 * 3. `resolveCommitContextForExecutionCandidate()`. Failure -> this
 *    harness itself marks the record `FAILED` (dispatch is never
 *    reached — no Runner is ever invoked for this candidate, so nothing
 *    else would mark it). Success -> `dispatchCommitRunner()`, whose
 *    result (`ok:true`/`ok:false`) already reflects whatever the
 *    underlying Runner did to the record (Runners update their own
 *    record's status themselves — this harness never double-updates
 *    after a dispatch).
 *
 * No `"SKIPPED"` outcome exists in this PR: nothing in this flow
 * produces one — every path is either `LINKED` or `FAILED`. Adding one
 * now would be speculative.
 *
 * `migrationRecord.update()` is never wrapped in a defensive try/catch —
 * same as every Runner before it, a throw there is a real infrastructure
 * failure and propagates raw, aborting the whole run rather than being
 * silently absorbed.
 *
 * `persistPlan()` is called with `mode: "COMMIT"` — this harness is the
 * thing that actually dispatches Runners capable of real writes, so the
 * persisted `MigrationRun` row should say so (PR29 widened
 * `PersistPlanInput.mode` from a `"DRY_RUN"`-only restriction to the full
 * `MigrationRunMode`; `MigrationRun.mode`/`CreateRunInput.mode` already
 * accepted `"COMMIT"` all along).
 */
export async function runCommitExecutionPlan(
  input: RunCommitExecutionPlanInput,
): Promise<RunCommitExecutionPlanSummary> {
  const { executionPlan, contextConfig, runWriter, prisma, runners } = input;
  const { plan, executionCandidates } = executionPlan;

  const persisted = await runWriter.persistPlan({
    adapterKey: plan.adapterKey,
    sourceNamespace: plan.sourceNamespace,
    adapterVersion: plan.adapterVersion,
    plan,
    mode: "COMMIT",
  });

  const recordBySourceRecordKey = new Map<string, MigrationRecord>(
    persisted.records.map((record) => [record.sourceRecordKey, record]),
  );

  const results: RunCommitExecutionPlanCandidateResult[] = [];

  for (const executionCandidate of executionCandidates) {
    const sourceRecordKey = executionCandidate.planItem.sourceRecordKey;
    const migrationRecord = recordBySourceRecordKey.get(sourceRecordKey);

    if (!migrationRecord) {
      results.push({
        sourceRecordKey,
        outcome: "FAILED",
        errorCode: "MISSING_MIGRATION_RECORD",
        errorMessage: `persistPlan() did not return a MigrationRecord for sourceRecordKey "${sourceRecordKey}".`,
      });
      continue;
    }

    const contextResult = resolveCommitContextForExecutionCandidate({
      executionCandidate,
      config: contextConfig,
    });

    if (!contextResult.ok) {
      await prisma.migrationRecord.update({
        where: { id: migrationRecord.id },
        data: {
          status: "FAILED",
          lastErrorCode: contextResult.errorCode,
          lastErrorMessage: contextResult.errorMessage,
        },
      });
      results.push({
        sourceRecordKey,
        recordId: migrationRecord.id,
        outcome: "FAILED",
        errorCode: contextResult.errorCode,
        errorMessage: contextResult.errorMessage,
      });
      continue;
    }

    const dispatchResult = await dispatchCommitRunner({
      executionCandidate,
      resolvedContext: contextResult.context,
      migrationRecord,
      runners,
    });

    if (dispatchResult.ok) {
      results.push({
        sourceRecordKey,
        recordId: migrationRecord.id,
        outcome: "LINKED",
        targetId: dispatchResult.targetId,
        lineageId: dispatchResult.lineageId,
      });
    } else {
      results.push({
        sourceRecordKey,
        recordId: migrationRecord.id,
        outcome: "FAILED",
        errorCode: dispatchResult.errorCode,
        errorMessage: dispatchResult.errorMessage,
      });
    }
  }

  return {
    total: results.length,
    linked: results.filter((result) => result.outcome === "LINKED").length,
    failed: results.filter((result) => result.outcome === "FAILED").length,
    results,
  };
}
