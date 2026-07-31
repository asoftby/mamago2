import type { ExactRecordExecutor } from "../adapter";
import type { PhoenixExpectedRecord, PhoenixRecordResult } from "../types";

export interface RoutesMigrationCandidate { sourceRecordKey: string; domainHash: string; slug: string }
export interface RoutesTargetState { lineageCount: number; targetCount: number; lineageTargetExists: boolean; lineageDomainHash: string | null }
export function planRoutesCreateAction(hash: string, target: RoutesTargetState): { action: "CREATE" | "SKIP_UNCHANGED" | "CONFLICT" | "FAILED"; reason: string | null } {
  if (target.lineageCount > 1) return { action: "FAILED", reason: "DUPLICATE_LINEAGE" };
  if (target.targetCount > 1) return { action: "FAILED", reason: "DUPLICATE_TARGET" };
  if (target.lineageCount === 0) return target.targetCount === 1 ? { action: "CONFLICT", reason: "TARGET_WITHOUT_LINEAGE" } : { action: "CREATE", reason: null };
  if (!target.lineageTargetExists) return { action: "CONFLICT", reason: "LINEAGE_WITHOUT_TARGET" };
  if (target.lineageDomainHash !== hash) return { action: "CONFLICT", reason: "HASH_MISMATCH" };
  return { action: "SKIP_UNCHANGED", reason: null };
}
export interface RoutesMigrationDependencies { loadCandidate(key: string): RoutesMigrationCandidate; resolveTargetState(candidate: RoutesMigrationCandidate): Promise<RoutesTargetState>; write(candidate: RoutesMigrationCandidate): Promise<{ targetId: string }> }
export class RoutesPhaseExecutor implements ExactRecordExecutor {
  constructor(private readonly deps: RoutesMigrationDependencies) {}
  async execute(sourceRecordKey: string, expectedAction: PhoenixExpectedRecord["action"]): Promise<PhoenixRecordResult> {
    try {
      const candidate = this.deps.loadCandidate(sourceRecordKey); const plan = planRoutesCreateAction(candidate.domainHash, await this.deps.resolveTargetState(candidate));
      if (plan.action === "FAILED") return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: plan.reason ?? "FAILED" };
      if (plan.action === "CONFLICT") return { sourceRecordKey, action: expectedAction, outcome: "PROTECTED_CONFLICT", error: plan.reason ?? "CONFLICT" };
      if (plan.action !== expectedAction) return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: `UNEXPECTED_PLAN_ACTION:${plan.action}` };
      if (plan.action === "SKIP_UNCHANGED") return { sourceRecordKey, action: expectedAction, outcome: "SKIPPED" };
      await this.deps.write(candidate); return { sourceRecordKey, action: expectedAction, outcome: "CREATED" };
    } catch (error) { return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: error instanceof Error ? error.message : String(error) }; }
  }
}
