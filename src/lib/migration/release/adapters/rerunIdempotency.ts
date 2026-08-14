import type { PhoenixExpectedRecord } from "../types";

/** Execution mode passed into phase executors from `SequentialEntityPhaseAdapter`. */
export type PhoenixExecuteMode = "APPLY" | "RERUN";

export interface PhoenixExecuteOptions {
  mode?: PhoenixExecuteMode;
}

/**
 * Rerun-only idempotency: after a successful full migration, every canonical
 * CREATE record's live planner correctly returns SKIP_UNCHANGED (lineage +
 * target + unchanged-state/hash already proven inside that planner). Accept
 * that single mismatch as SKIPPED — never during --plan/--apply, never for
 * UPDATE/CREATE live plans, never for other unexpected actions.
 */
export function isRerunIdempotentCreateSkip(
  expectedAction: PhoenixExpectedRecord["action"],
  planAction: string,
  options?: PhoenixExecuteOptions,
): boolean {
  return options?.mode === "RERUN" && expectedAction === "CREATE" && planAction === "SKIP_UNCHANGED";
}

/**
 * Idempotency rerun must never create. A live CREATE plan means the target
 * is missing / not proven complete — fail closed instead of writing.
 */
export function isRerunForbiddenLiveCreate(planAction: string, options?: PhoenixExecuteOptions): boolean {
  return options?.mode === "RERUN" && planAction === "CREATE";
}
