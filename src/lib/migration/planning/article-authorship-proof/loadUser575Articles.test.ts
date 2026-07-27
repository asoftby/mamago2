import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadUser575ArticleCandidates } from "./loadUser575Articles";

/**
 * Fully self-contained: writes a synthetic Activity-snapshot-shaped fixture
 * to the OS temp dir (not the durable `~/.mamago2/migration-snapshots/`
 * path, and not `/tmp/scratchpad/`) so this test never depends on any
 * machine-specific snapshot. Cleaned up in `test.after`.
 */
function writeSnapshotFixture(root: string, posts: ReadonlyArray<Record<string, unknown>>): void {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "posts.json"), JSON.stringify(posts));
  writeFileSync(join(root, "postmeta.json"), JSON.stringify([]));
  writeFileSync(
    join(root, "manifest.json"),
    JSON.stringify({ entity: "activity", capturedAt: "2026-01-01T00:00:00.000Z", queryVersion: "test", canonicalSnapshotHash: "test", rowCounts: { posts: posts.length, postmetaRelevant: 0, terms: 0 }, fullActivityInventory: { eventStatusBreakdown: [] } }),
  );
}

function post(overrides: Record<string, unknown>): Record<string, unknown> {
  return { post_date: "2026-01-01 00:00:00", post_name: "", post_modified: "2026-01-01 00:00:00", post_parent: 0, guid: "", ...overrides };
}

let root: string;

test.after(() => {
  rmSync(root, { recursive: true, force: true });
});

test("extracts exactly the 2 published 'post'-type records authored by user:575, sorted by post ID", () => {
  root = mkdtempSync(join(tmpdir(), "user575-articles-test-"));
  writeSnapshotFixture(root, [
    post({ ID: 57731, post_author: 575, post_type: "post", post_status: "publish" }),
    post({ ID: 56250, post_author: 575, post_type: "post", post_status: "publish" }),
    post({ ID: 1, post_author: 42, post_type: "post", post_status: "publish" }),
    post({ ID: 2, post_author: 575, post_type: "events", post_status: "publish" }),
  ]);

  const candidates = loadUser575ArticleCandidates(root);
  assert.deepEqual(
    candidates.map(candidate => candidate.sourceRecordKey),
    ["wordpress-db:post:56250", "wordpress-db:post:57731"],
  );
  assert.deepEqual(
    candidates.map(candidate => candidate.legacyPostId),
    [56250, 57731],
  );
});

test("a count other than exactly 2 throws BLOCKED_COUNT_MISMATCH, never silently continues", () => {
  root = mkdtempSync(join(tmpdir(), "user575-articles-test-"));
  writeSnapshotFixture(root, [post({ ID: 1, post_author: 575, post_type: "post", post_status: "publish" })]);

  assert.throws(() => loadUser575ArticleCandidates(root), /BLOCKED_COUNT_MISMATCH/);
});

test("three matching records also throws BLOCKED_COUNT_MISMATCH", () => {
  root = mkdtempSync(join(tmpdir(), "user575-articles-test-"));
  writeSnapshotFixture(root, [
    post({ ID: 1, post_author: 575, post_type: "post", post_status: "publish" }),
    post({ ID: 2, post_author: 575, post_type: "post", post_status: "publish" }),
    post({ ID: 3, post_author: 575, post_type: "post", post_status: "publish" }),
  ]);

  assert.throws(() => loadUser575ArticleCandidates(root), /BLOCKED_COUNT_MISMATCH/);
});
