import type { ExactRecordExecutor } from "../adapter";
import { exactExecutableKeys } from "../manifest";
import type { PhoenixExpectedRecord, PhoenixPhaseAdapter, PhoenixPhaseReport, PhoenixRecordResult, PhoenixReleasePhase } from "../types";
import { isRerunForbiddenLiveCreate, isRerunIdempotentCreateSkip, type PhoenixExecuteOptions } from "./rerunIdempotency";

export interface EventsMigrationCandidate {
  sourceRecordKey: string;
  domainHash: string;
  ownerUserSourceRecordKey: string;
  placeSourceRecordKey: string | null;
}

export interface EventsTargetState {
  lineageCount: number;
  targetExists: boolean;
  lineageDomainHash: string | null;
  duplicateLineageTarget: boolean;
}

export interface EventsPhasePreflightResult {
  ok: boolean;
  blocker: "EVENTS_UNCLASSIFIABLE_TARGET_STATE" | "DUPLICATE_LINEAGE" | "DUPLICATE_LINEAGE_TARGET" | "LINEAGE_WITHOUT_TARGET" | null;
  activityWithoutLineageIds: string[];
  duplicateSourceRecordKeys: string[];
  duplicateTargetIds: string[];
  missingTargetIds: string[];
}

export function planEventsCreateAction(hash: string, target: EventsTargetState): { action: "CREATE" | "SKIP_UNCHANGED" | "CONFLICT" | "FAILED"; reason: string | null } {
  if (target.lineageCount > 1) return { action: "FAILED", reason: "DUPLICATE_LINEAGE" };
  if (target.duplicateLineageTarget) return { action: "FAILED", reason: "DUPLICATE_LINEAGE_TARGET" };
  if (target.lineageCount === 0) return { action: "CREATE", reason: null };
  if (!target.targetExists) return { action: "CONFLICT", reason: "LINEAGE_WITHOUT_TARGET" };
  if (target.lineageDomainHash !== hash) return { action: "CONFLICT", reason: "HASH_MISMATCH" };
  return { action: "SKIP_UNCHANGED", reason: null };
}

export interface EventsMigrationDependencies {
  loadCandidate(sourceRecordKey: string): EventsMigrationCandidate;
  resolveTargetState(candidate: EventsMigrationCandidate): Promise<EventsTargetState>;
  write(candidate: EventsMigrationCandidate): Promise<{ targetId: string }>;
}

export class EventsPhaseExecutor implements ExactRecordExecutor {
  constructor(private readonly deps: EventsMigrationDependencies) {}
  async execute(
    sourceRecordKey: string,
    expectedAction: PhoenixExpectedRecord["action"],
    options?: PhoenixExecuteOptions,
  ): Promise<PhoenixRecordResult> {
    try {
      const candidate = this.deps.loadCandidate(sourceRecordKey);
      const plan = planEventsCreateAction(candidate.domainHash, await this.deps.resolveTargetState(candidate));
      if (plan.action === "FAILED") return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: plan.reason ?? "FAILED" };
      if (plan.action === "CONFLICT") return { sourceRecordKey, action: expectedAction, outcome: "PROTECTED_CONFLICT", error: plan.reason ?? "CONFLICT" };
      if (isRerunForbiddenLiveCreate(plan.action, options)) {
        return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: "RERUN_LIVE_CREATE_FORBIDDEN" };
      }
      if (plan.action !== expectedAction) {
        if (isRerunIdempotentCreateSkip(expectedAction, plan.action, options)) {
          return { sourceRecordKey, action: expectedAction, outcome: "SKIPPED" };
        }
        return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: `UNEXPECTED_PLAN_ACTION:${plan.action}` };
      }
      if (plan.action === "SKIP_UNCHANGED") return { sourceRecordKey, action: expectedAction, outcome: "SKIPPED" };
      await this.deps.write(candidate);
      return { sourceRecordKey, action: expectedAction, outcome: "CREATED" };
    } catch (error) {
      return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: error instanceof Error ? error.message : String(error) };
    }
  }
}

/** Fresh-target release-only adapter. Preflight runs before the first record in every mode. */
export class EventsFreshTargetPhaseAdapter implements PhoenixPhaseAdapter {
  constructor(private readonly preflight: () => Promise<EventsPhasePreflightResult>, private readonly executor: EventsPhaseExecutor) {}
  plan = async (phase: PhoenixReleasePhase): Promise<PhoenixRecordResult[]> =>
    phase.records
      .filter((record) => exactExecutableKeys(phase).includes(record.sourceRecordKey))
      .map((record) => ({
        sourceRecordKey: record.sourceRecordKey,
        action: record.action,
        outcome: record.action === "UPDATE_CONFLICT" ? "PROTECTED_CONFLICT" : "SKIPPED",
      }));
  apply = (phase: PhoenixReleasePhase) => this.run(phase, "APPLY");
  rerun = (phase: PhoenixReleasePhase) => this.run(phase, "RERUN");
  reconcile = async (): Promise<Partial<PhoenixPhaseReport>> => ({});

  private async run(
    phase: PhoenixReleasePhase,
    mode: NonNullable<PhoenixExecuteOptions["mode"]>,
  ): Promise<PhoenixRecordResult[]> {
    const checked = await this.preflight();
    if (!checked.ok) return [{ sourceRecordKey: "events:phase-preflight", action: "CREATE", outcome: "FAILED", error: checked.blocker ?? "EVENTS_UNCLASSIFIABLE_TARGET_STATE" }];
    const allowed = new Set(exactExecutableKeys(phase));
    const results: PhoenixRecordResult[] = [];
    for (const record of phase.records) {
      if (!allowed.has(record.sourceRecordKey)) continue;
      const result = await this.executor.execute(record.sourceRecordKey, record.action, { mode });
      results.push(result);
      if (result.outcome === "FAILED") break;
    }
    return results;
  }
}
