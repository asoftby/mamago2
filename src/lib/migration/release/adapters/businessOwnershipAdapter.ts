import type { ExactRecordExecutor } from "../adapter";
import type { PhoenixExpectedRecord, PhoenixRecordResult } from "../types";

/**
 * Thin Phoenix wrapper around the already-proven business-ownership +
 * BUSINESS_OWNER elevation pipeline (`BusinessOwnershipGoldenRunner`,
 * `RoleElevationGoldenCandidate` in `src/lib/migration/commit/business-*`).
 * Two sourceRecordKey scopes are handled by the SAME executor:
 *
 * - The 36 generic `EXACT_LINK_CANDIDATE` users: owned-Place scope comes
 *   from `resolveGenericOwnedPlaceSourcePostIds`.
 * - The 2 manual-override users (`wordpress-db:user:89`,
 *   `wordpress-db:user:130`): owned-Place scope comes verbatim from the
 *   frozen `phoenix-business-ownership-overrides-2026-07-30.json`
 *   artifact, never from the generic resolver. A missing, extra,
 *   reordered, or duplicated Place ID versus that exact frozen list is a
 *   FAILED outcome, not a partial write.
 *
 * The manifest's phase.records ordering already places the 36 generic
 * entries before the 2 override entries (see
 * generate-phoenix-business-ownership-artifacts.ts) — `SequentialEntityPhaseAdapter`
 * preserves that order, so this executor never needs to reorder anything
 * itself, only to pick the right Place-ID source per record.
 */

export interface BusinessOwnershipOverride {
  sourceRecordKey: string;
  approvedPlaceSourcePostIds: readonly string[];
}

export interface UserDependencyResolution {
  matchCount: number;
  userId: string | null;
}

export interface OwnershipLinkResult {
  action: "CREATE" | "SKIP_UNCHANGED";
  businessId: string;
  linkedPlaceCount: number;
}

export interface RoleElevationResult {
  action: "CREATE" | "SKIP_UNCHANGED";
}

export interface BusinessOwnershipDependencies {
  resolveUserDependency(sourceRecordKey: string): Promise<UserDependencyResolution>;
  resolveGenericOwnedPlaceSourcePostIds(sourceRecordKey: string): Promise<readonly string[]>;
  linkOwnership(
    userId: string,
    approvedPlaceSourcePostIds: readonly string[],
  ): Promise<OwnershipLinkResult>;
  elevateToBusinessOwner(userId: string): Promise<RoleElevationResult>;
}

function assertNoDuplicates(placeIds: readonly string[], sourceRecordKey: string): void {
  if (new Set(placeIds).size !== placeIds.length) {
    throw new Error(`DUPLICATE_OVERRIDE_PLACE_ID:${sourceRecordKey}`);
  }
}

export class BusinessOwnershipPhaseExecutor implements ExactRecordExecutor {
  private readonly overridesByKey: Map<string, readonly string[]>;

  constructor(
    private readonly deps: BusinessOwnershipDependencies,
    overrides: readonly BusinessOwnershipOverride[],
  ) {
    for (const override of overrides) assertNoDuplicates(override.approvedPlaceSourcePostIds, override.sourceRecordKey);
    this.overridesByKey = new Map(overrides.map((o) => [o.sourceRecordKey, o.approvedPlaceSourcePostIds]));
  }

  async execute(
    sourceRecordKey: string,
    expectedAction: PhoenixExpectedRecord["action"],
  ): Promise<PhoenixRecordResult> {
    // Every dependency call is guarded end-to-end: an unexpected throw
    // from any real implementation (not just linkOwnership) must become a
    // structured FAILED result, never an escaped exception — otherwise
    // `runSequential`'s stop-on-first-error loop and its
    // `reportStore.append` audit trail are bypassed entirely.
    try {
      const user = await this.deps.resolveUserDependency(sourceRecordKey);
      if (user.matchCount !== 1 || !user.userId) {
        return {
          sourceRecordKey,
          action: expectedAction,
          outcome: "FAILED",
          error: user.matchCount === 0 ? "USER_DEPENDENCY_NOT_FOUND" : "USER_DEPENDENCY_AMBIGUOUS",
        };
      }

      const override = this.overridesByKey.get(sourceRecordKey);
      const approvedPlaceSourcePostIds: readonly string[] = override
        ? override
        : await this.deps.resolveGenericOwnedPlaceSourcePostIds(sourceRecordKey);
      if (approvedPlaceSourcePostIds.length === 0) {
        return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: "MISSING_APPROVED_PLACE_SCOPE" };
      }

      const ownership = await this.deps.linkOwnership(user.userId, approvedPlaceSourcePostIds);
      if (ownership.linkedPlaceCount !== approvedPlaceSourcePostIds.length) {
        return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: "OWNERSHIP_PLACE_COUNT_MISMATCH" };
      }

      const role = await this.deps.elevateToBusinessOwner(user.userId);
      // Rerun tolerance: both sub-steps landing on SKIP_UNCHANGED is the
      // expected idempotent outcome even when expectedAction is CREATE for
      // a first-run manifest re-applied a second time.
      const outcome: PhoenixRecordResult["outcome"] =
        ownership.action === "CREATE" || role.action === "CREATE" ? "CREATED" : "SKIPPED";
      return { sourceRecordKey, action: expectedAction, outcome };
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
