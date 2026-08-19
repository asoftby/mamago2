import type { ExactRecordExecutor } from "../adapter";
import type { PhoenixExpectedRecord, PhoenixRecordResult } from "../types";

/**
 * Thin Phoenix wrapper around the already-proven Users vertical-slice
 * pipeline (`planUserMigration`/`writeUserMigration` in
 * `src/lib/migration/commit/user`). Deliberately depends on an injected
 * interface, not the concrete Prisma-backed functions, so tests can run
 * entirely on fakes — no DB, no WordPress SSH, no real writes. The real
 * production wiring (constructing `UsersMigrationDependencies` from the
 * actual snapshot + `PrismaClient`) is a separate, later step gated on the
 * Users phase actually becoming executable.
 */

export interface UsersMigrationCandidate {
  sourceRecordKey: string;
}

export interface UsersMigrationPlanResult {
  action: "CREATE" | "SKIP_UNCHANGED" | "BLOCKED";
  reason: string | null;
  draftRole: "USER" | "ADMIN" | "MODERATOR" | "BUSINESS_OWNER" | null;
}

export interface UsersMigrationWriteResult {
  action: "CREATE" | "SKIP_UNCHANGED";
  targetId: string | null;
}

export interface UsersMigrationDependencies {
  loadCandidate(sourceRecordKey: string): UsersMigrationCandidate;
  plan(candidate: UsersMigrationCandidate): Promise<UsersMigrationPlanResult>;
  write(candidate: UsersMigrationCandidate, plan: UsersMigrationPlanResult): Promise<UsersMigrationWriteResult>;
}

const NON_USER_ROLES = new Set(["ADMIN", "MODERATOR", "BUSINESS_OWNER"]);

/**
 * `executeExpectedAction` is compared against the plan, not blindly
 * trusted: a plan that disagrees with what the frozen manifest expects is
 * a FAILED outcome (stop-on-first-error upstream), never silently
 * reconciled to whichever action actually happened.
 */
export class UsersPhaseExecutor implements ExactRecordExecutor {
  constructor(private readonly deps: UsersMigrationDependencies) {}

  async execute(
    sourceRecordKey: string,
    expectedAction: PhoenixExpectedRecord["action"],
  ): Promise<PhoenixRecordResult> {
    // Every dependency call is guarded: an unexpected throw from a real
    // implementation must become a structured FAILED result, never an
    // escaped exception — otherwise `runSequential`'s stop-on-first-error
    // loop and its `reportStore.append` audit trail are bypassed entirely.
    try {
      const candidate = this.deps.loadCandidate(sourceRecordKey);
      const plan = await this.deps.plan(candidate);

      if (plan.action === "BLOCKED") {
        return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: plan.reason ?? "BLOCKED" };
      }
      if (plan.action !== expectedAction) {
        return {
          sourceRecordKey,
          action: expectedAction,
          outcome: "FAILED",
          error: `UNEXPECTED_PLAN_ACTION:${plan.action}`,
        };
      }
      // ADMIN/MODERATOR/BUSINESS_OWNER elevation is never a Users-phase
      // responsibility — role elevation only happens in the Businesses
      // phase, and only for the exact 38 approved sourceRecordKeys.
      if (plan.draftRole && NON_USER_ROLES.has(plan.draftRole)) {
        return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: "ADMIN_MUTATION_FORBIDDEN" };
      }
      if (plan.action === "SKIP_UNCHANGED") {
        return { sourceRecordKey, action: expectedAction, outcome: "SKIPPED" };
      }
      const result = await this.deps.write(candidate, plan);
      return {
        sourceRecordKey,
        action: expectedAction,
        outcome: result.action === "CREATE" ? "CREATED" : "SKIPPED",
      };
    } catch (error) {
      return {
        sourceRecordKey,
        action: expectedAction,
        outcome: "FAILED",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
