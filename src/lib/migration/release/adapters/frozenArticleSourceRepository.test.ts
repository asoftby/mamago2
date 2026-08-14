import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";

import { FrozenArticleSourceRepository } from "./frozenArticleSourceRepository";

const KEY = "wordpress-db:post:42";

function record(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceRecordKey: KEY,
    sourceEntityType: "wordpress-db:post",
    sourceStableKey: "42",
    sourceHash: "wordpress-db-domain-v2:fixture",
    sourceUpdatedAt: "2026-01-01 00:00:00",
    rawPayload: {
      post: { ID: 42, post_title: "Title", post_name: "title", post_content: "<p>Body</p>", post_excerpt: "Excerpt", post_status: "publish", post_date: "2026-01-01 00:00:00", post_modified: "2026-01-02 00:00:00" },
      postMeta: {}, terms: [],
    },
    ...overrides,
  };
}

function artifact(records: unknown[] = [record()], overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { schemaVersion: 1, entity: "articles", capturedAt: "2026-01-02T00:00:00.000Z", records, ...overrides };
}

function repository(value: unknown, shaOverride?: string): FrozenArticleSourceRepository {
  const root = mkdtempSync(join(tmpdir(), "phoenix-article-loader-"));
  mkdirSync(join(root, "articles"));
  const raw = `${JSON.stringify(value)}\n`;
  writeFileSync(join(root, "articles", "capture.json"), raw, { mode: 0o600 });
  const sha = shaOverride ?? createHash("sha256").update(raw).digest("hex");
  return new FrozenArticleSourceRepository(root, sha);
}

function expectError(action: () => unknown, message: string): void {
  assert.throws(action, (error: unknown) => error instanceof Error && error.message === message);
}

function main(): void {
  const valid = repository(artifact());
  const first = valid.loadNormalizedCandidate(KEY);
  assert.equal(first.title, "Title");
  assert.deepEqual(first, valid.loadNormalizedCandidate(KEY), "load result must be deterministic");

  expectError(() => repository(artifact()).loadNormalizedCandidate("wordpress-db:post:404"), "FAILED:ARTICLE_SOURCE_RECORD_MISSING");
  expectError(() => repository(artifact([record(), record()])).loadNormalizedCandidate(KEY), "FAILED:DUPLICATE_ARTICLE_SOURCE_RECORD");
  expectError(() => repository(artifact(), "0".repeat(64)).loadNormalizedCandidate(KEY), "RELEASE_BLOCKED:ARTICLE_ARTIFACT_CHECKSUM_MISMATCH");
  expectError(() => repository(artifact([record()], { schemaVersion: 2 })).loadNormalizedCandidate(KEY), "FAILED:UNSUPPORTED_ARTICLE_ARTIFACT_VERSION");
  expectError(() => repository(artifact([record({ rawPayload: { postMeta: {}, terms: [] } })])).loadNormalizedCandidate(KEY), "FAILED:MALFORMED_ARTICLE_RECORD");
  console.log("Frozen Articles source repository tests: PASS");
}

main();
