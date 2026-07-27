import type { ActivitySnapshotMetaRow, ActivitySnapshotPostRow } from "./loadActivitySnapshot";
import type { ActivityDependencyEntry, ActivityDependencyVerdict } from "./types";

const PLACE_LINK_META_KEYS = new Set(["event_place", "event-place", "event_place_id", "place_id"]);
const LOCATION_EVIDENCE_META_KEYS = new Set(["location", "event-place-name", "adress-event-place", "event_city"]);
const MEDIA_META_KEYS = new Set(["gallery", "_thumbnail_id"]);

function sourceRecordKeyFor(post: ActivitySnapshotPostRow): string {
  return `wordpress-db:${post.post_type}:${post.ID}`;
}

/**
 * Classifies each captured post into CREATE / EXCLUDED / MANUAL / BLOCKED.
 * Pure function — no I/O. `alreadyMigratedKeys` and `userLineagePresentByAuthor`
 * are read-only facts the caller already gathered from the local DB.
 */
export function classifyActivityDependencies(
  posts: readonly ActivitySnapshotPostRow[],
  postmeta: readonly ActivitySnapshotMetaRow[],
  alreadyMigratedKeys: ReadonlySet<string>,
  userLineagePresentByAuthor: ReadonlyMap<number, boolean>,
): readonly ActivityDependencyEntry[] {
  const metaByPost = new Map<number, Map<string, string[]>>();
  for (const row of postmeta) {
    const byKey = metaByPost.get(row.post_id) ?? new Map<string, string[]>();
    const values = byKey.get(row.meta_key) ?? [];
    if (row.meta_value !== null) values.push(row.meta_value);
    byKey.set(row.meta_key, values);
    metaByPost.set(row.post_id, byKey);
  }

  return posts
    .map(post => {
      const meta = metaByPost.get(post.ID) ?? new Map<string, string[]>();
      const hasScheduleEvidence = post.post_type === "events" && meta.has("event_date");
      const hasStructuredPlaceLink = [...PLACE_LINK_META_KEYS].some(key => meta.has(key));
      const hasFreeTextLocationEvidence = [...LOCATION_EVIDENCE_META_KEYS].some(key => meta.has(key));
      const hasMediaEvidence = [...MEDIA_META_KEYS].some(key => meta.has(key));
      const sourceRecordKey = sourceRecordKeyFor(post);
      const alreadyMigrated = alreadyMigratedKeys.has(sourceRecordKey);
      const userLineagePresent = userLineagePresentByAuthor.get(post.post_author) ?? false;

      const reasonCodes: string[] = [];
      let verdict: ActivityDependencyVerdict;

      if (alreadyMigrated) {
        verdict = "MANUAL"; // should not occur for this cohort (Slice 15 confirmed 0 migrated) — flagged, not assumed away
        reasonCodes.push("UNEXPECTED_ALREADY_MIGRATED");
      } else if (!userLineagePresent) {
        verdict = "BLOCKED";
        reasonCodes.push("USER_LINEAGE_MISSING");
      } else if (post.post_status !== "publish") {
        verdict = "EXCLUDED";
        reasonCodes.push("EXCLUDED_BY_EXISTING_PUBLISH_ONLY_POLICY", `SOURCE_STATUS_${post.post_status.toUpperCase()}`);
      } else if (post.post_type === "events" && !hasScheduleEvidence) {
        verdict = "MANUAL";
        reasonCodes.push("MISSING_SCHEDULE_EVIDENCE");
      } else {
        verdict = "CREATE";
        reasonCodes.push("STATUS_PUBLISH_ELIGIBLE");
        if (!hasStructuredPlaceLink && post.post_type === "events") reasonCodes.push("NO_STRUCTURED_PLACE_LINK_PLACE_OPTIONAL_ON_ACTIVITY");
      }

      return {
        sourceRecordKey,
        legacyAuthorSourceRecordKey: `wordpress-db:user:${post.post_author}`,
        postType: post.post_type as "events" | "post",
        postStatus: post.post_status,
        hasScheduleEvidence,
        hasStructuredPlaceLink,
        hasFreeTextLocationEvidence,
        hasMediaEvidence,
        alreadyMigrated,
        verdict,
        reasonCodes,
      } satisfies ActivityDependencyEntry;
    })
    .sort((a, b) => (a.sourceRecordKey < b.sourceRecordKey ? -1 : a.sourceRecordKey > b.sourceRecordKey ? 1 : 0));
}
