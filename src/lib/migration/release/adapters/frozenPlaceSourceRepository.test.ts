import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { FrozenPlaceSourceRepository } from "./frozenPlaceSourceRepository";

const KEY = "wordpress-db:places:42";

function record(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceRecordKey: KEY, sourceEntityType: "wordpress-db:places", sourceStableKey: "42",
    sourceHash: "wordpress-db-domain-v2:fixture", sourceUpdatedAt: "2026-01-01 00:00:00",
    rawPayload: {
      post: { ID: 42, post_author: 7, post_title: "Place Title", post_name: "place-title", post_content: "Body", post_excerpt: "", post_status: "publish", post_type: "places", post_date: "2026-01-01 00:00:00", post_modified: "2026-01-02 00:00:00" },
      postMeta: {}, terms: [], placeIndex: null,
    },
    ...overrides,
  };
}

function artifact(records: unknown[] = [record()], overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { schemaVersion: 1, entity: "places", capturedAt: "2026-01-02T00:00:00.000Z", records, ...overrides };
}

function repository(value: unknown, shaOverride?: string): FrozenPlaceSourceRepository {
  const root = mkdtempSync(join(tmpdir(), "phoenix-place-loader-"));
  mkdirSync(join(root, "places"));
  const raw = `${JSON.stringify(value)}\n`;
  writeFileSync(join(root, "places", "capture.json"), raw, { mode: 0o600 });
  const sha = shaOverride ?? createHash("sha256").update(raw).digest("hex");
  return new FrozenPlaceSourceRepository(root, sha);
}

function expectError(action: () => unknown, message: string): void {
  assert.throws(action, (error: unknown) => error instanceof Error && error.message === message);
}

function main(): void {
  const valid = repository(artifact());
  assert.equal(valid.loadNormalizedCandidate(KEY).title, "Place Title");
  assert.equal(valid.loadLegacyAuthorId(KEY), 7);
  assert.equal(valid.loadSourceHash(KEY), "wordpress-db-domain-v2:fixture");

  expectError(() => repository(artifact()).loadNormalizedCandidate("wordpress-db:places:404"), "FAILED:PLACE_SOURCE_RECORD_MISSING");
  expectError(() => repository(artifact([record(), record()])).loadNormalizedCandidate(KEY), "FAILED:DUPLICATE_PLACE_SOURCE_RECORD");
  expectError(() => repository(artifact(), "0".repeat(64)).loadNormalizedCandidate(KEY), "RELEASE_BLOCKED:PLACE_ARTIFACT_CHECKSUM_MISMATCH");
  expectError(() => repository(artifact([record()], { schemaVersion: 2 })).loadNormalizedCandidate(KEY), "FAILED:UNSUPPORTED_PLACE_ARTIFACT_VERSION");
  console.log("Frozen Places source repository tests: PASS");
}

main();
