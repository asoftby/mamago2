/**
 * USERS Slice 16: read-only Activity migration dependency inventory for
 * the 10 `TARGET_NOT_MIGRATED` content-author users (Slice 15). Sourced
 * from the standalone Activity snapshot captured under
 * `/Users/shapovalovalexey/.mamago2/migration-snapshots/activities/` (never
 * `/tmp`) — the first independent immutable snapshot for this entity, not
 * a repeat of the USERS snapshot.
 */

export type ActivityDependencyVerdict = "CREATE" | "EXCLUDED" | "MANUAL" | "BLOCKED";

export interface ActivityDependencyEntry {
  sourceRecordKey: string;
  legacyAuthorSourceRecordKey: string;
  postType: "events" | "post";
  postStatus: string;
  /** Present for `events` only — required to build a schedule draft (`event_date` postmeta). */
  hasScheduleEvidence: boolean;
  /** A structured Voxel Place-post-id reference (`event_place`/`place_id`/etc.) — none of these were found for any captured event. */
  hasStructuredPlaceLink: boolean;
  /** Free-text venue evidence (`location`/`event-place-name`/`adress-event-place`/`event_city`) — not an exact lineage match, would need separate resolution. */
  hasFreeTextLocationEvidence: boolean;
  /** `gallery` or `_thumbnail_id` postmeta present. */
  hasMediaEvidence: boolean;
  /** From the local read-only DB: does this sourceRecordKey already have an active MigrationLineage row? */
  alreadyMigrated: boolean;
  verdict: ActivityDependencyVerdict;
  reasonCodes: readonly string[];
}

export interface ActivityDependencyInventorySummary {
  totalEntries: number;
  byVerdict: Record<ActivityDependencyVerdict, number>;
  byPostStatus: Record<string, number>;
  fullActivityInventoryStatusBreakdown: Record<string, number>;
}
