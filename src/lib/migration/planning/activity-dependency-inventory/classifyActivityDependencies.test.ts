import assert from "node:assert/strict";
import test from "node:test";

import { classifyActivityDependencies } from "./classifyActivityDependencies";
import type { ActivitySnapshotMetaRow, ActivitySnapshotPostRow } from "./loadActivitySnapshot";

function post(overrides: Partial<ActivitySnapshotPostRow> & { ID: number; post_author: number; post_type: string; post_status: string }): ActivitySnapshotPostRow {
  return { post_date: "2026-01-01 00:00:00", post_name: "", post_modified: "2026-01-01 00:00:00", post_parent: 0, guid: "", ...overrides };
}
function meta(post_id: number, meta_key: string, meta_value: string): ActivitySnapshotMetaRow {
  return { meta_id: post_id * 1000, post_id, meta_key, meta_value };
}

test("an expired event is EXCLUDED under the existing publish-only policy, never treated as a new problem", () => {
  const posts = [post({ ID: 1, post_author: 42, post_type: "events", post_status: "expired" })];
  const meta1 = [meta(1, "event_date", '[{"start":"2024-01-01"}]')];
  const [entry] = classifyActivityDependencies(posts, meta1, new Set(), new Map([[42, true]]));
  assert.equal(entry.verdict, "EXCLUDED");
  assert.ok(entry.reasonCodes.includes("EXCLUDED_BY_EXISTING_PUBLISH_ONLY_POLICY"));
});

test("a published event with schedule evidence is CREATE-eligible even with no structured Place link (Place is optional on Activity)", () => {
  const posts = [post({ ID: 2, post_author: 42, post_type: "events", post_status: "publish" })];
  const meta1 = [meta(2, "event_date", '[{"start":"2024-01-01"}]')];
  const [entry] = classifyActivityDependencies(posts, meta1, new Set(), new Map([[42, true]]));
  assert.equal(entry.verdict, "CREATE");
  assert.equal(entry.hasStructuredPlaceLink, false);
});

test("a published event with no schedule evidence is MANUAL, not silently assumed CREATE-eligible", () => {
  const posts = [post({ ID: 3, post_author: 42, post_type: "events", post_status: "publish" })];
  const [entry] = classifyActivityDependencies(posts, [], new Set(), new Map([[42, true]]));
  assert.equal(entry.verdict, "MANUAL");
  assert.ok(entry.reasonCodes.includes("MISSING_SCHEDULE_EVIDENCE"));
});

test("a published article needs no schedule evidence and is CREATE-eligible", () => {
  const posts = [post({ ID: 4, post_author: 575, post_type: "post", post_status: "publish" })];
  const [entry] = classifyActivityDependencies(posts, [], new Set(), new Map([[575, true]]));
  assert.equal(entry.verdict, "CREATE");
});

test("missing User lineage is BLOCKED, never guessed at", () => {
  const posts = [post({ ID: 5, post_author: 999, post_type: "events", post_status: "publish" })];
  const meta1 = [meta(5, "event_date", '[{"start":"2024-01-01"}]')];
  const [entry] = classifyActivityDependencies(posts, meta1, new Set(), new Map());
  assert.equal(entry.verdict, "BLOCKED");
  assert.ok(entry.reasonCodes.includes("USER_LINEAGE_MISSING"));
});

test("a post already carrying an active MigrationLineage is flagged, never silently reprocessed", () => {
  const posts = [post({ ID: 6, post_author: 42, post_type: "events", post_status: "publish" })];
  const meta1 = [meta(6, "event_date", '[{"start":"2024-01-01"}]')];
  const [entry] = classifyActivityDependencies(posts, meta1, new Set(["wordpress-db:events:6"]), new Map([[42, true]]));
  assert.equal(entry.verdict, "MANUAL");
  assert.equal(entry.alreadyMigrated, true);
  assert.ok(entry.reasonCodes.includes("UNEXPECTED_ALREADY_MIGRATED"));
});

test("free-text location and media evidence are detected independently of the structured Place link", () => {
  const posts = [post({ ID: 7, post_author: 42, post_type: "events", post_status: "publish" })];
  const meta1 = [meta(7, "event_date", '[{"start":"2024-01-01"}]'), meta(7, "location", "some address"), meta(7, "gallery", "1,2,3")];
  const [entry] = classifyActivityDependencies(posts, meta1, new Set(), new Map([[42, true]]));
  assert.equal(entry.hasFreeTextLocationEvidence, true);
  assert.equal(entry.hasMediaEvidence, true);
  assert.equal(entry.hasStructuredPlaceLink, false);
});

test("results are sorted deterministically by sourceRecordKey regardless of input order", () => {
  const posts = [
    post({ ID: 20, post_author: 1, post_type: "events", post_status: "publish" }),
    post({ ID: 10, post_author: 1, post_type: "events", post_status: "publish" }),
  ];
  const meta1 = [meta(20, "event_date", "x"), meta(10, "event_date", "x")];
  const entries = classifyActivityDependencies(posts, meta1, new Set(), new Map([[1, true]]));
  assert.deepEqual(
    entries.map(e => e.sourceRecordKey),
    ["wordpress-db:events:10", "wordpress-db:events:20"],
  );
});
