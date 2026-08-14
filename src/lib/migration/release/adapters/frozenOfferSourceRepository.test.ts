import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { FrozenOfferSourceRepository } from "./frozenOfferSourceRepository";

const KEY = "wordpress-db:hb-programs:42";

function record(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceRecordKey: KEY,
    sourceEntityType: "wordpress-db:hb-programs",
    sourceStableKey: "42",
    sourceHash: "wordpress-db-domain-v2:fixture",
    sourceUpdatedAt: "2026-01-01 00:00:00",
    rawPayload: {
      post: { ID: 42, post_title: "Title", post_name: "title", post_content: "Body", post_excerpt: "", post_status: "publish", post_type: "hb-programs", post_date: "2026-01-01 00:00:00", post_modified: "2026-01-02 00:00:00" },
      postMeta: {},
      terms: [],
      placeRelations: [{ post_id: 42, related_post_id: 100, related_post_type: "places", relation_key: "post-relation-hb-programs", relation_order: 0, relation_side: "parent" }],
    },
    ...overrides,
  };
}

function artifact(records: unknown[] = [record()], overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { schemaVersion: 1, entity: "offers", capturedAt: "2026-01-02T00:00:00.000Z", records, ...overrides };
}

function repository(value: unknown, shaOverride?: string): FrozenOfferSourceRepository {
  const root = mkdtempSync(join(tmpdir(), "phoenix-offer-loader-"));
  mkdirSync(join(root, "offers"));
  const raw = `${JSON.stringify(value)}\n`;
  writeFileSync(join(root, "offers", "capture.json"), raw, { mode: 0o600 });
  const sha = shaOverride ?? createHash("sha256").update(raw).digest("hex");
  return new FrozenOfferSourceRepository(root, sha);
}

function expectError(action: () => unknown, message: string): void {
  assert.throws(action, (error: unknown) => error instanceof Error && error.message === message);
}

function main(): void {
  const valid = repository(artifact());
  const first = valid.loadNormalizedCandidate(KEY);
  assert.equal(first.title, "Title");
  assert.deepEqual(first, valid.loadNormalizedCandidate(KEY), "load result must be deterministic");

  expectError(() => repository(artifact()).loadNormalizedCandidate("wordpress-db:hb-programs:404"), "FAILED:OFFER_SOURCE_RECORD_MISSING");
  expectError(() => repository(artifact([record(), record()])).loadNormalizedCandidate(KEY), "FAILED:DUPLICATE_OFFER_SOURCE_RECORD");
  expectError(() => repository(artifact(), "0".repeat(64)).loadNormalizedCandidate(KEY), "RELEASE_BLOCKED:OFFER_ARTIFACT_CHECKSUM_MISMATCH");
  expectError(() => repository(artifact([record()], { schemaVersion: 2 })).loadNormalizedCandidate(KEY), "FAILED:UNSUPPORTED_OFFER_ARTIFACT_VERSION");
  expectError(() => repository(artifact([record({ rawPayload: { postMeta: {}, terms: [], placeRelations: [] } })])).loadNormalizedCandidate(KEY), "FAILED:MALFORMED_OFFER_RECORD");
  console.log("Frozen Offers source repository tests: PASS");
}

main();
