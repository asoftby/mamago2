import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FrozenRouteSourceRepository } from "./frozenRouteSourceRepository";
const KEY = "wordpress-db:routes:42";
function record(overrides: Record<string, unknown> = {}) { return { sourceRecordKey: KEY, sourceHash: "hash", rawPayload: { post: { ID: 42, post_title: "Route", post_name: "route", post_status: "publish", post_date: "2026-01-01", post_modified: "2026-01-02" }, postMeta: { "title-location-1": ["Stop"], "description-location-1": ["Note"] }, terms: [] }, ...overrides }; }
function repo(records: unknown[], version = 1, sha?: string) { const root = mkdtempSync(join(tmpdir(), "route-loader-")); mkdirSync(join(root, "routes")); const raw = JSON.stringify({ schemaVersion: version, entity: "routes", capturedAt: "2026-01-01T00:00:00Z", records }); writeFileSync(join(root, "routes/capture.json"), raw); return new FrozenRouteSourceRepository(root, sha ?? createHash("sha256").update(raw).digest("hex")); }
function main() {
  const valid = repo([record()]); assert.equal(valid.load(KEY).normalized.slug, "route"); assert.deepEqual(valid.load(KEY), valid.load(KEY));
  assert.throws(() => repo([record()]).load("missing"), /FAILED:ROUTE_SOURCE_RECORD_MISSING/);
  assert.throws(() => repo([record(), record()]).load(KEY), /FAILED:DUPLICATE_ROUTE_SOURCE_RECORD/);
  assert.throws(() => repo([record()], 1, "0".repeat(64)).load(KEY), /RELEASE_BLOCKED:ROUTE_ARTIFACT_CHECKSUM_MISMATCH/);
  assert.throws(() => repo([record()], 2).load(KEY), /RELEASE_BLOCKED:UNSUPPORTED_ROUTE_ARTIFACT_VERSION/);
  assert.throws(() => repo([record({ rawPayload: {} })]).load(KEY), /FAILED:MALFORMED_ROUTE_RECORD/);
  console.log("Frozen Routes source repository tests: PASS");
}
main();
