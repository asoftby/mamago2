import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FrozenEventSourceRepository } from "./frozenEventSourceRepository";

const KEY = "wordpress-db:events:42";
function record(overrides: Record<string, unknown> = {}) { return { sourceRecordKey: KEY, sourceHash: "wordpress-db-domain-v2:x", rawPayload: { post: { ID: 42, post_author: 7, post_title: "Event", post_name: "event", post_content: "Body", post_excerpt: "Excerpt", post_status: "publish", post_date: "2026-01-01 00:00:00", post_modified: "2026-01-01 00:00:00" }, postMeta: { event_date: ["2026-08-01 10:00:00"] }, terms: [] }, ...overrides }; }
function repo(records: unknown[], version = 1, sha?: string) {
  const root = mkdtempSync(join(tmpdir(), "event-loader-")); mkdirSync(join(root, "events"));
  const raw = JSON.stringify({ schemaVersion: version, entity: "events", capturedAt: "2026-01-01T00:00:00Z", records });
  writeFileSync(join(root, "events/capture.json"), raw);
  return new FrozenEventSourceRepository(root, sha ?? createHash("sha256").update(raw).digest("hex"));
}
function main() {
  const loaded = repo([record()]).load(KEY); assert.equal(loaded.normalized.title, "Event"); assert.equal(loaded.ownerUserSourceRecordKey, "wordpress-db:user:7");
  assert.throws(() => repo([record()]).load("missing"), /FAILED:EVENT_SOURCE_RECORD_MISSING/);
  assert.throws(() => repo([record(), record()]).load(KEY), /FAILED:DUPLICATE_EVENT_SOURCE_RECORD/);
  assert.throws(() => repo([record()], 1, "0".repeat(64)).load(KEY), /RELEASE_BLOCKED:EVENT_ARTIFACT_CHECKSUM_MISMATCH/);
  assert.throws(() => repo([record()], 2).load(KEY), /FAILED:UNSUPPORTED_EVENT_ARTIFACT_VERSION/);
  assert.throws(() => repo([record({ rawPayload: {} })]).load(KEY), /FAILED:MALFORMED_EVENT_RECORD/);
  assert.deepEqual(repo([record()]).load(KEY).normalized, repo([record()]).load(KEY).normalized);
  console.log("Frozen Events source repository tests: PASS");
}
main();
