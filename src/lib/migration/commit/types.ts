import type { MigrationPlanAction, MigrationRecord, MigrationTargetType } from "@prisma/client";

/**
 * `MigrationTargetType`/`MigrationPlanAction` are Prisma's generated types
 * (already re-used the same way by `../ledger` and `../writer`) — this
 * module reads no rows and calls no Prisma client, but its input
 * (`MigrationRecord[]`) is exactly what PR7's writer persists, so its
 * fields are typed by the same enums, not a third hand-rolled copy.
 */
export type { MigrationPlanAction, MigrationRecord, MigrationTargetType };

export interface BuildCommitExecutionPlanOptions {
  /**
   * Required, no default/hardcoded fallback inside this module — the
   * planner has no opinion on "what the system currently supports
   * committing," only on how to plan whatever set the caller passes in.
   * Pass `[]` before any entity writer exists; grow it one target type at
   * a time as PR9+ lands.
   */
  supportedTargetTypes: readonly MigrationTargetType[];
}

export type RollbackStepKind = "DELETE_CREATED_TARGET" | "RESTORE_PREVIOUS_TARGET_STATE";

/**
 * A single undo step. `targetId` is always `null` in PR8 — no entity
 * writer exists yet, so there is no real target row id to reference.
 */
export interface RollbackStep {
  kind: RollbackStepKind;
  recordId: string;
  sourceRecordKey: string;
  targetId: string | null;
}

export interface CommitOperation {
  recordId: string;
  sourceRecordKey: string;
  targetType: MigrationTargetType;
  action: Extract<MigrationPlanAction, "CREATE" | "UPDATE">;
  /** Position in the final, ordered execution queue (0-indexed). */
  order: number;
  /** Other operations' `recordId`s this one must run after. Always `[]` in PR8 — no cross-record dependency graph yet. */
  dependsOn: readonly string[];
  rollbackSteps: readonly RollbackStep[];
}

export type BlockedReasonCode =
  | "SOURCE_RECORD_FAILED"
  | "MISSING_TARGET_TYPE"
  | "PLAN_ACTION_NOT_COMMITTABLE";

export interface BlockedCommitRecord {
  recordId: string;
  sourceRecordKey: string;
  reasonCode: BlockedReasonCode;
  reason: string;
}

export interface UnsupportedCommitRecord {
  recordId: string;
  sourceRecordKey: string;
  targetType: MigrationTargetType;
  reasonCode: "TARGET_TYPE_UNSUPPORTED";
  reason: string;
}

export interface SkippedCommitRecord {
  recordId: string;
  sourceRecordKey: string;
  planAction: MigrationPlanAction;
  reasonCode: "NOOP_PLAN_ACTION";
  reason: string;
}

export interface CommitExecutionPlanSummary {
  totalRecords: number;
  operationCount: number;
  blockedCount: number;
  unsupportedCount: number;
  skippedCount: number;
  createCount: number;
  updateCount: number;
  byTargetType: Record<string, number>;
  byReasonCode: Record<string, number>;
}

export interface CommitExecutionPlan {
  operations: readonly CommitOperation[];
  blocked: readonly BlockedCommitRecord[];
  unsupported: readonly UnsupportedCommitRecord[];
  skipped: readonly SkippedCommitRecord[];
  /** Every operation's rollback steps, flattened, in reverse-of-execution order — the order you'd actually run them to undo the whole plan. */
  rollbackPlan: readonly RollbackStep[];
  summary: CommitExecutionPlanSummary;
}
