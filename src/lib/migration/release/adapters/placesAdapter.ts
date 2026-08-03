import type { ExactRecordExecutor } from "../adapter";
import type { PhoenixExpectedRecord, PhoenixRecordResult } from "../types";
import { planLineageOnlyCreateAction, type LineageOnlyTargetState } from "./lineageOnlyPlanner";
import { isRerunForbiddenLiveCreate, isRerunIdempotentCreateSkip, type PhoenixExecuteOptions } from "./rerunIdempotency";

/**
 * Thin Phoenix wrapper for the first Places release onto a FRESH (clean)
 * target environment — 78 records, `CREATE`/`SKIP_UNCHANGED`/`CONFLICT`/
 * `FAILED` only, no `UPDATE` path. Mirrors `articlesAdapter.ts`'s shape:
 * `Place` has no `createRequestId`-equivalent idempotency column, so
 * target-state is resolved purely through `MigrationLineage` via the
 * shared `lineageOnlyPlanner`.
 *
 * Unlike Article, Place has one real dependency: `createdByUserId`
 * (required — verified against schema). See `placesProductionWiring.ts`
 * for how that's resolved (WordPress `post_author` -> `MigrationLineage`
 * USER lookup, never a hardcoded target UUID).
 */

export interface PlacesLogicalDependencyPlan {
  ownerUserSourceRecordKey: string;
}

export interface PlacesMigrationCandidate {
  sourceRecordKey: string;
  domainHash: string;
  dependencyPlan: PlacesLogicalDependencyPlan;
}

export interface ResolvedPlacesDependencies {
  createdByUserId: string;
  ownerBusinessId?: string | null;
}

export interface PlacesMigrationWriteResult {
  targetId: string;
}

export interface PlacesMigrationDependencies {
  loadCandidate(sourceRecordKey: string): PlacesMigrationCandidate;
  resolveTargetState(candidate: PlacesMigrationCandidate): Promise<LineageOnlyTargetState>;
  resolveDependencies(candidate: PlacesMigrationCandidate): Promise<ResolvedPlacesDependencies>;
  write(candidate: PlacesMigrationCandidate, dependencies: ResolvedPlacesDependencies): Promise<PlacesMigrationWriteResult>;
}

export class PlacesPhaseExecutor implements ExactRecordExecutor {
  constructor(private readonly deps: PlacesMigrationDependencies) {}

  async execute(
    sourceRecordKey: string,
    expectedAction: PhoenixExpectedRecord["action"],
    options?: PhoenixExecuteOptions,
  ): Promise<PhoenixRecordResult> {
    try {
      const candidate = this.deps.loadCandidate(sourceRecordKey);
      const target = await this.deps.resolveTargetState(candidate);
      const plan = planLineageOnlyCreateAction(candidate.domainHash, target);

      if (plan.action === "FAILED") {
        return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: plan.reason ?? "FAILED" };
      }
      if (plan.action === "CONFLICT") {
        return { sourceRecordKey, action: expectedAction, outcome: "PROTECTED_CONFLICT", error: plan.reason ?? "CONFLICT" };
      }
      if (isRerunForbiddenLiveCreate(plan.action, options)) {
        return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: "RERUN_LIVE_CREATE_FORBIDDEN" };
      }
      if (plan.action !== expectedAction) {
        if (isRerunIdempotentCreateSkip(expectedAction, plan.action, options)) {
          return { sourceRecordKey, action: expectedAction, outcome: "SKIPPED" };
        }
        return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: `UNEXPECTED_PLAN_ACTION:${plan.action}` };
      }
      if (plan.action === "SKIP_UNCHANGED") {
        return { sourceRecordKey, action: expectedAction, outcome: "SKIPPED" };
      }
      const dependencies = await this.deps.resolveDependencies(candidate);
      await this.deps.write(candidate, dependencies);
      return { sourceRecordKey, action: expectedAction, outcome: "CREATED" };
    } catch (error) {
      return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: error instanceof Error ? error.message : String(error) };
    }
  }
}
