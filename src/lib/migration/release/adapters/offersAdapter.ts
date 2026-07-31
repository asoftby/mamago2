import type { ExactRecordExecutor } from "../adapter";
import type { PhoenixExpectedRecord, PhoenixRecordResult } from "../types";

/**
 * Thin Phoenix wrapper for the first Offers release onto a FRESH (clean)
 * target environment. Deliberately depends on an injected interface, not
 * concrete Prisma-backed functions, so tests run entirely on fakes — no DB,
 * no WordPress SSH, no real writes. The real production wiring (constructing
 * `OffersMigrationDependencies` from `OfferDomainHashV2`
 * (`src/lib/migration/commit/offer/offerDomainHash.ts`) plus a `PrismaClient`)
 * is a separate, later step gated on a proven clean-target DEV baseline.
 *
 * This is NOT the LOCAL Offers reconciliation/update pipeline
 * (`OfferCommitRunner` + `planOfferHashTransition` in `commit/offer/`) —
 * that pipeline solves a different problem (bringing 63 already-migrated
 * LOCAL Offer rows onto `OfferDomainHashV2`) and its 63 unsupported
 * multi-field conflicts are historical LOCAL evidence, out of scope for a
 * clean DEV target. This executor never performs UPDATE — the plan action
 * type has no UPDATE member, and `write()` only ever creates.
 */

export type OffersDependencyReadiness = "EXISTS_NOW" | "WILL_EXIST_AFTER_PREREQUISITE_PHASE";

export interface OffersLogicalDependencyPlan {
  placeSourceRecordKey: string;
  businessSourceKey: string | null;
  placeReadiness: OffersDependencyReadiness;
  businessReadiness: OffersDependencyReadiness | null;
}

export interface OffersMigrationCandidate {
  sourceRecordKey: string;
  domainHashV2: string;
  dependencyPlan: OffersLogicalDependencyPlan;
}

export interface OffersTargetLineageState {
  lineageCount: number;
  targetExists: boolean;
  duplicateTarget: boolean;
  lineageDomainHash: string | null;
}

export type OffersMigrationPlanAction = "CREATE" | "SKIP_UNCHANGED" | "CONFLICT" | "FAILED";

export interface OffersMigrationPlanResult {
  action: OffersMigrationPlanAction;
  reason: string | null;
}

export interface ResolvedOffersDependencies {
  placeId: string;
  ownerUserId: string;
  businessId: string | null;
  cityId: string;
}

export interface OffersMigrationWriteResult {
  targetId: string;
}

export interface OffersMigrationDependencies {
  loadCandidate(sourceRecordKey: string): OffersMigrationCandidate;
  resolveTargetState(candidate: OffersMigrationCandidate): Promise<OffersTargetLineageState>;
  /**
   * Must re-resolve Place/Business/owner dependencies against real target
   * state, even when planning already classified them as
   * `WILL_EXIST_AFTER_PREREQUISITE_PHASE` — that classification only
   * governs whether a phase can be planned before its prerequisites ran,
   * never whether the write itself may skip resolution. Implementations
   * must throw (never return a partial/best-effort match) on zero matches,
   * more than one match, or a Place/Business owner-relation mismatch.
   */
  resolveDependencies(candidate: OffersMigrationCandidate): Promise<ResolvedOffersDependencies>;
  write(candidate: OffersMigrationCandidate, dependencies: ResolvedOffersDependencies): Promise<OffersMigrationWriteResult>;
}

/**
 * Pure, DB-agnostic idempotency planner keyed on `OfferDomainHashV2`
 * (see `commit/offer/offerDomainHash.ts`). `target` reflects a lookup
 * exactly like the one `commit/offer` already performs: an active
 * `MigrationLineage` row (`sourceRecordKey`, `targetType: "OFFER"`,
 * `targetRole: "primary"`) plus the `Offer` row it names, resolved via
 * `Offer.createRequestId` (which the create draft always sets to
 * `sourceRecordKey`) rather than a hardcoded target UUID.
 */
export function planOffersCreateAction(candidate: OffersMigrationCandidate, target: OffersTargetLineageState): OffersMigrationPlanResult {
  if (target.lineageCount > 1) return { action: "FAILED", reason: "DUPLICATE_LINEAGE" };
  if (target.duplicateTarget) return { action: "FAILED", reason: "DUPLICATE_TARGET" };
  if (target.lineageCount === 0) {
    return target.targetExists ? { action: "CONFLICT", reason: "TARGET_WITHOUT_LINEAGE" } : { action: "CREATE", reason: null };
  }
  if (!target.targetExists) return { action: "CONFLICT", reason: "LINEAGE_WITHOUT_TARGET" };
  if (target.lineageDomainHash !== candidate.domainHashV2) return { action: "CONFLICT", reason: "DOMAIN_HASH_CHANGED" };
  return { action: "SKIP_UNCHANGED", reason: null };
}

/**
 * Planning-time-only dependency readiness classifier. `EXISTS_NOW` requires
 * an actual resolvable match today; `WILL_EXIST_AFTER_PREREQUISITE_PHASE`
 * is only permitted when the owning prerequisite phase is itself `READY`
 * (never `BLOCKED` or `VALIDATION_ONLY`) — a phase can't be planned around
 * a dependency phase that isn't cleared to run. This classification never
 * substitutes for the mandatory runtime resolution in `resolveDependencies`.
 */
export function classifyDependencyReadiness(input: {
  prerequisitePhaseStatus: "READY" | "BLOCKED" | "VALIDATION_ONLY";
  dependencyResolvableNow: boolean;
}): OffersDependencyReadiness {
  if (input.dependencyResolvableNow) return "EXISTS_NOW";
  if (input.prerequisitePhaseStatus === "READY") return "WILL_EXIST_AFTER_PREREQUISITE_PHASE";
  throw new Error("DEPENDENCY_PREREQUISITE_PHASE_NOT_READY");
}

export class OffersPhaseExecutor implements ExactRecordExecutor {
  constructor(private readonly deps: OffersMigrationDependencies) {}

  async execute(sourceRecordKey: string, expectedAction: PhoenixExpectedRecord["action"]): Promise<PhoenixRecordResult> {
    // Every dependency call is guarded: an unexpected throw from a real
    // implementation must become a structured FAILED result, never an
    // escaped exception — otherwise `runSequential`'s stop-on-first-error
    // loop and its report-store audit trail are bypassed entirely.
    try {
      const candidate = this.deps.loadCandidate(sourceRecordKey);
      const target = await this.deps.resolveTargetState(candidate);
      const plan = planOffersCreateAction(candidate, target);

      if (plan.action === "FAILED") {
        return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: plan.reason ?? "FAILED" };
      }
      if (plan.action === "CONFLICT") {
        return { sourceRecordKey, action: expectedAction, outcome: "PROTECTED_CONFLICT", error: plan.reason ?? "CONFLICT" };
      }
      if (plan.action !== expectedAction) {
        return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: `UNEXPECTED_PLAN_ACTION:${plan.action}` };
      }
      if (plan.action === "SKIP_UNCHANGED") {
        return { sourceRecordKey, action: expectedAction, outcome: "SKIPPED" };
      }
      // plan.action === "CREATE": dependencies are always resolved for real
      // here, never trusted from planning-time readiness classification.
      const dependencies = await this.deps.resolveDependencies(candidate);
      await this.deps.write(candidate, dependencies);
      return { sourceRecordKey, action: expectedAction, outcome: "CREATED" };
    } catch (error) {
      return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: error instanceof Error ? error.message : String(error) };
    }
  }
}
