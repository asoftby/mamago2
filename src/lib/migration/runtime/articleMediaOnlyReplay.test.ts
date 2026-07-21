/**
 * Run: tsx src/lib/migration/runtime/articleMediaOnlyReplay.test.ts (assert-based, project convention).
 */
import assert from "node:assert/strict";

import { CANONICAL_SOURCE_HASH_VERSION, hashArticleBundle } from "../adapters/wordpress-db/canonicalSourceHash";
import type { WordPressArticleBundle, WordPressPostRow } from "../adapters/wordpress-db/types";
import {
  parseArticlePostIdFromSourceRecordKey,
  validateArticleMediaReplayArgs,
  validateArticleMediaReplayRuntime,
} from "./articleMediaOnlyReplay";

function postRow(overrides: Partial<WordPressPostRow> = {}): WordPressPostRow {
  return {
    ID: 24774,
    post_author: 1,
    post_date: "2024-08-13 17:48:21",
    post_content: "<p>Text.</p>",
    post_title: "Тае 10 лет",
    post_excerpt: "",
    post_status: "publish",
    post_name: "tae-10-let",
    post_modified: "2024-08-13 17:49:56",
    post_parent: 0,
    guid: "https://mamago.by/?p=24774",
    post_type: "post",
    post_mime_type: "",
    ...overrides,
  };
}

function bundle(overrides: Partial<WordPressArticleBundle> = {}, postOverrides: Partial<WordPressPostRow> = {}): WordPressArticleBundle {
  return {
    post: postRow(postOverrides),
    postMeta: {},
    terms: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseArticlePostIdFromSourceRecordKey
// ---------------------------------------------------------------------------

function testParseValidKey() {
  assert.equal(parseArticlePostIdFromSourceRecordKey("wordpress-db:post:24774"), 24774);
}

function testParseInvalidKey() {
  assert.equal(parseArticlePostIdFromSourceRecordKey("wordpress-db:places:24774"), null);
  assert.equal(parseArticlePostIdFromSourceRecordKey("wordpress-db:post:abc"), null);
  assert.equal(parseArticlePostIdFromSourceRecordKey(""), null);
}

// ---------------------------------------------------------------------------
// validateArticleMediaReplayArgs
// ---------------------------------------------------------------------------

const VALID_ARGS = {
  entity: "article",
  sourceRecordKeyCount: 1,
  mediaPolicyName: "FULL" as const,
  forceReprocess: false,
  forceMediaReprocess: false,
  mediaOwnerUserId: "user-1",
};

function testArgsValid() {
  assert.deepEqual(validateArticleMediaReplayArgs(VALID_ARGS), { ok: true });
}

function testArgsRequiresEntityArticle() {
  const result = validateArticleMediaReplayArgs({ ...VALID_ARGS, entity: "place" });
  assert.equal(result.ok, false);
}

function testArgsRequiresExactlyOneSourceRecordKey() {
  assert.equal(validateArticleMediaReplayArgs({ ...VALID_ARGS, sourceRecordKeyCount: 0 }).ok, false);
  assert.equal(validateArticleMediaReplayArgs({ ...VALID_ARGS, sourceRecordKeyCount: 2 }).ok, false);
}

function testArgsRequiresMediaPolicyFull() {
  assert.equal(validateArticleMediaReplayArgs({ ...VALID_ARGS, mediaPolicyName: "METADATA" }).ok, false);
  assert.equal(validateArticleMediaReplayArgs({ ...VALID_ARGS, mediaPolicyName: undefined }).ok, false);
}

function testArgsRejectsForceReprocess() {
  assert.equal(validateArticleMediaReplayArgs({ ...VALID_ARGS, forceReprocess: true }).ok, false);
}

function testArgsRejectsForceMediaReprocess() {
  assert.equal(validateArticleMediaReplayArgs({ ...VALID_ARGS, forceMediaReprocess: true }).ok, false);
}

function testArgsRequiresMediaOwnerUserId() {
  assert.equal(validateArticleMediaReplayArgs({ ...VALID_ARGS, mediaOwnerUserId: undefined }).ok, false);
  assert.equal(validateArticleMediaReplayArgs({ ...VALID_ARGS, mediaOwnerUserId: "  " }).ok, false);
}

// ---------------------------------------------------------------------------
// validateArticleMediaReplayRuntime
// ---------------------------------------------------------------------------

function testRuntimeRequiresActiveLineageCountExactlyOne() {
  const b = bundle();
  const hash = hashArticleBundle(b);
  const result = validateArticleMediaReplayRuntime({
    bundle: b,
    lineage: { sourceId: "s", isActive: true, targetId: "article-1", lastSourceHash: hash },
    activeLineageCount: 2,
    targetExists: true,
  });
  assert.equal(result.ok, false);
}

function testRuntimeRequiresBundle() {
  const result = validateArticleMediaReplayRuntime({
    bundle: null,
    lineage: null,
    activeLineageCount: 1,
    targetExists: false,
  });
  assert.equal(result.ok, false);
}

function testRuntimeRequiresActiveLineage() {
  const b = bundle();
  const result = validateArticleMediaReplayRuntime({
    bundle: b,
    lineage: null,
    activeLineageCount: 0,
    targetExists: false,
  });
  assert.equal(result.ok, false);
}

function testRuntimeRequiresTargetExists() {
  const b = bundle();
  const hash = hashArticleBundle(b);
  const result = validateArticleMediaReplayRuntime({
    bundle: b,
    lineage: { sourceId: "s", isActive: true, targetId: "article-1", lastSourceHash: hash },
    activeLineageCount: 1,
    targetExists: false,
  });
  assert.equal(result.ok, false);
}

function testRuntimeRequiresCanonicalHashFormat() {
  const b = bundle();
  const result = validateArticleMediaReplayRuntime({
    bundle: b,
    lineage: { sourceId: "s", isActive: true, targetId: "article-1", lastSourceHash: "legacy-hash-abc" },
    activeLineageCount: 1,
    targetExists: true,
  });
  assert.equal(result.ok, false);
}

function testRuntimeRefusesOnHashMismatch() {
  const b = bundle();
  const staleHash = `${CANONICAL_SOURCE_HASH_VERSION}:not-the-real-hash`;
  const result = validateArticleMediaReplayRuntime({
    bundle: b,
    lineage: { sourceId: "s", isActive: true, targetId: "article-1", lastSourceHash: staleHash },
    activeLineageCount: 1,
    targetExists: true,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /does not match the stored lineage hash/);
  }
}

function testRuntimeRefusesElementorContent() {
  const b = bundle({ postMeta: { _elementor_data: ["{}"] } });
  const hash = hashArticleBundle(b);
  const result = validateArticleMediaReplayRuntime({
    bundle: b,
    lineage: { sourceId: "s", isActive: true, targetId: "article-1", lastSourceHash: hash },
    activeLineageCount: 1,
    targetExists: true,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /Elementor/);
  }
}

function testRuntimeRefusesWebStoryContent() {
  const b = bundle({ postMeta: { "wp-story-image": ["123"] } });
  const hash = hashArticleBundle(b);
  const result = validateArticleMediaReplayRuntime({
    bundle: b,
    lineage: { sourceId: "s", isActive: true, targetId: "article-1", lastSourceHash: hash },
    activeLineageCount: 1,
    targetExists: true,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /Web Story/);
  }
}

function testRuntimeSucceedsOnExactHashMatch() {
  const b = bundle();
  const hash = hashArticleBundle(b);
  const result = validateArticleMediaReplayRuntime({
    bundle: b,
    lineage: { sourceId: "s", isActive: true, targetId: "article-1", lastSourceHash: hash },
    activeLineageCount: 1,
    targetExists: true,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.freshHash, hash);
    assert.equal(result.candidate.title, "Тае 10 лет");
  }
}

function main() {
  testParseValidKey();
  testParseInvalidKey();
  testArgsValid();
  testArgsRequiresEntityArticle();
  testArgsRequiresExactlyOneSourceRecordKey();
  testArgsRequiresMediaPolicyFull();
  testArgsRejectsForceReprocess();
  testArgsRejectsForceMediaReprocess();
  testArgsRequiresMediaOwnerUserId();
  testRuntimeRequiresActiveLineageCountExactlyOne();
  testRuntimeRequiresBundle();
  testRuntimeRequiresActiveLineage();
  testRuntimeRequiresTargetExists();
  testRuntimeRequiresCanonicalHashFormat();
  testRuntimeRefusesOnHashMismatch();
  testRuntimeRefusesElementorContent();
  testRuntimeRefusesWebStoryContent();
  testRuntimeSucceedsOnExactHashMatch();
}

main();
console.log("articleMediaOnlyReplay tests: OK");
