/**
 * USERS Slice 11: targeted read-only reconciliation for the 2
 * business-linked users left out of the Slice 7/8 exact-candidate batch
 * because their owned-Place lineage coverage was partial
 * (`wordpress-db:user:89`, `wordpress-db:user:130`). This module performs
 * no database writes — see `readOnlyRepository.ts` in
 * `planning/user-ownership` for the shared read-only enforcement pattern,
 * reused here.
 */

export type TailReconciliationVerdict = "SAFE_FUTURE_CANDIDATE" | "TARGET_PLACE_NOT_MIGRATED" | "AMBIGUOUS" | "CONFLICT" | "FOUNDER_DECISION_REQUIRED";

export interface PlaceCoverageBreakdown {
  totalOwnedPlaces: number;
  migratedPlaces: number;
  missingPlaces: number;
  /** WordPress `post_status` of every missing (not-yet-migrated) owned Place — e.g. {"unpublished": 187, "draft": 8}. */
  missingPlacesBySourceStatus: Readonly<Record<string, number>>;
}

export interface TailReconciliationEntry {
  sourceRecordKey: string;
  userLineagePresent: boolean;
  placeCoverage: PlaceCoverageBreakdown;
  /** True if none of the already-migrated owned Places currently belong to any Business (no conflicting prior claim). */
  migratedPlacesConflictFree: boolean;
  /** True if at least one missing Place has any MigrationRecord history at all (attempted-and-failed vs. never-attempted). */
  anyMissingPlaceEverAttempted: boolean;
  verdict: TailReconciliationVerdict;
  evidenceHash: string;
}
