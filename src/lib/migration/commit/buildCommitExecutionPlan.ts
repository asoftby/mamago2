import type {
  BlockedCommitRecord,
  BuildCommitExecutionPlanOptions,
  CommitExecutionPlan,
  CommitExecutionPlanSummary,
  CommitOperation,
  MigrationRecord,
  MigrationTargetType,
  RollbackStep,
  SkippedCommitRecord,
  UnsupportedCommitRecord,
} from "./types";

/** Fixed priority for the two target types with an actual entity writer planned first (PR9). Anything else sorts after, in caller-supplied order. */
const PRIORITY_TARGET_TYPES: readonly MigrationTargetType[] = ["ARTICLE", "PLACE"];

function targetTypeSortRank(
  targetType: MigrationTargetType,
  supportedTargetTypes: readonly MigrationTargetType[],
): number {
  const priorityIndex = PRIORITY_TARGET_TYPES.indexOf(targetType);
  if (priorityIndex !== -1) return priorityIndex;
  return PRIORITY_TARGET_TYPES.length + supportedTargetTypes.indexOf(targetType);
}

function buildRollbackStep(
  record: MigrationRecord,
  action: "CREATE" | "UPDATE",
): RollbackStep {
  return {
    kind: action === "CREATE" ? "DELETE_CREATED_TARGET" : "RESTORE_PREVIOUS_TARGET_STATE",
    recordId: record.id,
    sourceRecordKey: record.sourceRecordKey,
    // No entity writer exists yet (PR9+), so there is no real target row to reference.
    targetId: null,
  };
}

function buildSummary(
  totalRecords: number,
  operations: readonly CommitOperation[],
  blocked: readonly BlockedCommitRecord[],
  unsupported: readonly UnsupportedCommitRecord[],
  skipped: readonly SkippedCommitRecord[],
): CommitExecutionPlanSummary {
  const byTargetType: Record<string, number> = {};
  let createCount = 0;
  let updateCount = 0;
  for (const operation of operations) {
    byTargetType[operation.targetType] = (byTargetType[operation.targetType] ?? 0) + 1;
    if (operation.action === "CREATE") {
      createCount += 1;
    } else {
      updateCount += 1;
    }
  }

  const byReasonCode: Record<string, number> = {};
  for (const item of [...blocked, ...unsupported, ...skipped]) {
    byReasonCode[item.reasonCode] = (byReasonCode[item.reasonCode] ?? 0) + 1;
  }

  return {
    totalRecords,
    operationCount: operations.length,
    blockedCount: blocked.length,
    unsupportedCount: unsupported.length,
    skippedCount: skipped.length,
    createCount,
    updateCount,
    byTargetType,
    byReasonCode,
  };
}

/**
 * Pure transformation: `MigrationRecord[]` (already persisted by PR7) ->
 * `CommitExecutionPlan`. No Prisma, no DB reads, no entity/lineage writes —
 * this only decides *what a commit run would do*, not whether it runs.
 *
 * Per-record precedence, checked in this exact order (see PR8 scope):
 *   A. status === "FAILED"                        -> blocked (SOURCE_RECORD_FAILED), no further checks
 *   B. no targetTypeHint                           -> blocked (MISSING_TARGET_TYPE)
 *   C. targetTypeHint not in supportedTargetTypes  -> unsupported (TARGET_TYPE_UNSUPPORTED)
 *   D. planAction is SKIP_UNCHANGED/SKIP_POLICY    -> skipped (NOOP_PLAN_ACTION)
 *   E. planAction is CREATE/UPDATE                 -> queued as a CommitOperation
 *   F. anything else (e.g. planAction "FAIL" on a non-FAILED-status row)
 *                                                   -> blocked (PLAN_ACTION_NOT_COMMITTABLE)
 *
 * Ordering: ARTICLE first, then PLACE, then any other supported target type
 * in the order it appears in `supportedTargetTypes` — within a target type,
 * the original `records` order is preserved (stable sort).
 */
export function buildCommitExecutionPlan(
  records: readonly MigrationRecord[],
  options: BuildCommitExecutionPlanOptions,
): CommitExecutionPlan {
  const blocked: BlockedCommitRecord[] = [];
  const unsupported: UnsupportedCommitRecord[] = [];
  const skipped: SkippedCommitRecord[] = [];
  const candidates: { record: MigrationRecord; action: "CREATE" | "UPDATE" }[] = [];

  for (const record of records) {
    if (record.status === "FAILED") {
      blocked.push({
        recordId: record.id,
        sourceRecordKey: record.sourceRecordKey,
        reasonCode: "SOURCE_RECORD_FAILED",
        reason: `Record has status FAILED and cannot be committed.`,
      });
      continue;
    }

    if (!record.targetTypeHint) {
      blocked.push({
        recordId: record.id,
        sourceRecordKey: record.sourceRecordKey,
        reasonCode: "MISSING_TARGET_TYPE",
        reason: "Record has no targetTypeHint.",
      });
      continue;
    }

    if (!options.supportedTargetTypes.includes(record.targetTypeHint)) {
      unsupported.push({
        recordId: record.id,
        sourceRecordKey: record.sourceRecordKey,
        targetType: record.targetTypeHint,
        reasonCode: "TARGET_TYPE_UNSUPPORTED",
        reason: `Target type ${record.targetTypeHint} is not in supportedTargetTypes.`,
      });
      continue;
    }

    if (record.planAction === "SKIP_UNCHANGED" || record.planAction === "SKIP_POLICY") {
      skipped.push({
        recordId: record.id,
        sourceRecordKey: record.sourceRecordKey,
        planAction: record.planAction,
        reasonCode: "NOOP_PLAN_ACTION",
        reason: `planAction ${record.planAction} requires no commit action.`,
      });
      continue;
    }

    if (record.planAction === "CREATE" || record.planAction === "UPDATE") {
      candidates.push({ record, action: record.planAction });
      continue;
    }

    blocked.push({
      recordId: record.id,
      sourceRecordKey: record.sourceRecordKey,
      reasonCode: "PLAN_ACTION_NOT_COMMITTABLE",
      reason: `planAction ${record.planAction ?? "null"} cannot be committed.`,
    });
  }

  // Stable sort (Array.prototype.sort is spec-guaranteed stable) — records
  // that land on the same rank keep their original relative order.
  const ordered = [...candidates].sort(
    (a, b) =>
      targetTypeSortRank(a.record.targetTypeHint!, options.supportedTargetTypes) -
      targetTypeSortRank(b.record.targetTypeHint!, options.supportedTargetTypes),
  );

  const operations: CommitOperation[] = ordered.map(({ record, action }, index) => ({
    recordId: record.id,
    sourceRecordKey: record.sourceRecordKey,
    targetType: record.targetTypeHint!,
    action,
    order: index,
    dependsOn: [],
    rollbackSteps: [buildRollbackStep(record, action)],
  }));

  const rollbackPlan = [...operations].reverse().flatMap((operation) => operation.rollbackSteps);

  return {
    operations,
    blocked,
    unsupported,
    skipped,
    rollbackPlan,
    summary: buildSummary(records.length, operations, blocked, unsupported, skipped),
  };
}
