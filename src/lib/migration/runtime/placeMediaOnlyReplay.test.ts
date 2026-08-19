/**
 * Run: tsx src/lib/migration/runtime/placeMediaOnlyReplay.test.ts (assert-based, project convention).
 */
import assert from "node:assert/strict";

import type { WordPressPlaceBundle, WordPressPostRow } from "../adapters/wordpress-db/types";
import type { PlaceMediaSyncInput, PlaceMediaSyncResult } from "../commit/place/PlaceMediaSyncer";
import {
  parsePlacePostIdFromSourceRecordKey,
  runPlaceMediaOnlyReplay,
  validatePlaceMediaOnlyReplayArgs,
  validatePlaceMediaOnlyReplayRuntime,
  type PlaceMediaOnlyReplayer,
} from "./placeMediaOnlyReplay";

// ---------------------------------------------------------------------------
// parsePlacePostIdFromSourceRecordKey
// ---------------------------------------------------------------------------

function testParsesValidPlaceSourceRecordKey() {
  assert.equal(parsePlacePostIdFromSourceRecordKey("wordpress-db:places:5457"), 5457);
}

function testRejectsNonPlaceSourceRecordKey() {
  assert.equal(parsePlacePostIdFromSourceRecordKey("wordpress-db:events:5457"), null);
  assert.equal(parsePlacePostIdFromSourceRecordKey("wordpress-db:places:abc"), null);
  assert.equal(parsePlacePostIdFromSourceRecordKey("wordpress-db:places:0"), null);
  assert.equal(parsePlacePostIdFromSourceRecordKey("not-a-key"), null);
}

// ---------------------------------------------------------------------------
// validatePlaceMediaOnlyReplayArgs — pure CLI-flag guards.
// ---------------------------------------------------------------------------

function validArgs(overrides: Partial<Parameters<typeof validatePlaceMediaOnlyReplayArgs>[0]> = {}) {
  return {
    entity: "place",
    sourceRecordKeyCount: 1,
    mediaPolicyName: "FULL" as const,
    forceReprocess: false,
    forceMediaReprocess: false,
    forceArticleMediaReplay: false,
    ...overrides,
  };
}

function testArgsAcceptsValidCombo() {
  assert.equal(validatePlaceMediaOnlyReplayArgs(validArgs()).ok, true);
}

function testArgsRejectsWrongEntity() {
  const result = validatePlaceMediaOnlyReplayArgs(validArgs({ entity: "event" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /--entity place/);
}

function testArgsRejectsWrongSourceRecordKeyCount() {
  const zero = validatePlaceMediaOnlyReplayArgs(validArgs({ sourceRecordKeyCount: 0 }));
  assert.equal(zero.ok, false);
  const two = validatePlaceMediaOnlyReplayArgs(validArgs({ sourceRecordKeyCount: 2 }));
  assert.equal(two.ok, false);
}

function testArgsRejectsNonFullMediaPolicy() {
  const result = validatePlaceMediaOnlyReplayArgs(validArgs({ mediaPolicyName: "METADATA" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /--media-policy FULL/);
}

function testArgsRejectsCombinationWithOtherForceFlags() {
  assert.equal(validatePlaceMediaOnlyReplayArgs(validArgs({ forceReprocess: true })).ok, false);
  assert.equal(validatePlaceMediaOnlyReplayArgs(validArgs({ forceMediaReprocess: true })).ok, false);
  assert.equal(validatePlaceMediaOnlyReplayArgs(validArgs({ forceArticleMediaReplay: true })).ok, false);
}

// ---------------------------------------------------------------------------
// validatePlaceMediaOnlyReplayRuntime — DB/source-state guards.
// ---------------------------------------------------------------------------

function post(overrides: Partial<WordPressPostRow> = {}): WordPressPostRow {
  return {
    ID: 5457,
    post_author: 1,
    post_date: "2026-01-01 00:00:00",
    post_content: "<p>Nice place</p>",
    post_title: "Test Place",
    post_excerpt: "",
    post_status: "publish",
    post_name: "test-place",
    post_modified: "2026-01-02 00:00:00",
    post_parent: 0,
    guid: "https://wp.example.com/?p=5457",
    post_type: "places",
    post_mime_type: "",
    ...overrides,
  };
}

function bundleFixture(overrides: Partial<WordPressPlaceBundle> = {}): WordPressPlaceBundle {
  return {
    post: post(),
    postMeta: { cover: ["9001"], gallery: ["9002,9003"] },
    terms: [],
    placeIndex: null,
    ...overrides,
  };
}

function testRuntimeRejectsMissingSource() {
  const result = validatePlaceMediaOnlyReplayRuntime({ bundle: null, lineage: null, targetExists: false });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /No live published WordPress place/);
}

function testRuntimeRejectsMissingOrInactiveLineage() {
  const bundle = bundleFixture();
  const resultMissing = validatePlaceMediaOnlyReplayRuntime({ bundle, lineage: null, targetExists: true });
  assert.equal(resultMissing.ok, false);
  if (!resultMissing.ok) assert.match(resultMissing.reason, /No active PLACE lineage/);

  const resultInactive = validatePlaceMediaOnlyReplayRuntime({
    bundle,
    lineage: { sourceId: "src-1", isActive: false, targetId: "place-1" },
    targetExists: true,
  });
  assert.equal(resultInactive.ok, false);
  if (!resultInactive.ok) assert.match(resultInactive.reason, /No active PLACE lineage/);
}

function testRuntimeRejectsMissingTarget() {
  const bundle = bundleFixture();
  const result = validatePlaceMediaOnlyReplayRuntime({
    bundle,
    lineage: { sourceId: "src-1", isActive: true, targetId: "place-1" },
    targetExists: false,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /Target Place not found/);
}

function testRuntimeAcceptsValidStateAndNormalizes() {
  const bundle = bundleFixture();
  const result = validatePlaceMediaOnlyReplayRuntime({
    bundle,
    lineage: { sourceId: "src-1", isActive: true, targetId: "place-1" },
    targetExists: true,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.candidate.media.thumbnailAttachmentId, 9001);
    assert.deepEqual(result.candidate.media.galleryAttachmentIds, [9002, 9003]);
  }
}

// ---------------------------------------------------------------------------
// runPlaceMediaOnlyReplay — delegates to PlaceMediaSyncer.sync(), never
// touches Place content fields (there is no code path here that could).
// ---------------------------------------------------------------------------

function emptyResult(overrides: Partial<PlaceMediaSyncResult> = {}): PlaceMediaSyncResult {
  return { warnings: [], imported: 0, reused: 0, skipped: 0, failed: 0, ...overrides };
}

function fakeSyncer(result: PlaceMediaSyncResult, capture?: { input?: PlaceMediaSyncInput }): PlaceMediaOnlyReplayer {
  return {
    async sync(input: PlaceMediaSyncInput) {
      if (capture) capture.input = input;
      return result;
    },
  };
}

async function testRunRefusesWhenNoSourceMedia() {
  const candidate = { media: { thumbnailAttachmentId: null, galleryAttachmentIds: [] } } as never;
  const result = await runPlaceMediaOnlyReplay({
    sourceId: "src-1",
    sourceRecordKey: "wordpress-db:places:5457",
    placeId: "place-1",
    ownerUserId: "user-1",
    candidate,
    sourceHash: null,
    mediaSyncer: fakeSyncer(emptyResult()),
  });
  assert.equal(result.status, "REFUSED");
  if (result.status === "REFUSED") assert.equal(result.code, "PLACE_MEDIA_ONLY_SOURCE_MEDIA_MISSING");
}

async function testRunRefusesWhenOwnerMissing() {
  const candidate = { media: { thumbnailAttachmentId: 9001, galleryAttachmentIds: [] } } as never;
  const result = await runPlaceMediaOnlyReplay({
    sourceId: "src-1",
    sourceRecordKey: "wordpress-db:places:5457",
    placeId: "place-1",
    ownerUserId: undefined,
    candidate,
    sourceHash: null,
    mediaSyncer: fakeSyncer(emptyResult()),
  });
  assert.equal(result.status, "REFUSED");
  if (result.status === "REFUSED") assert.equal(result.code, "PLACE_MEDIA_OWNER_MISSING");
}

async function testRunReportsAppliedOnNewImports() {
  const candidate = { media: { thumbnailAttachmentId: 9001, galleryAttachmentIds: [9002] } } as never;
  const capture: { input?: PlaceMediaSyncInput } = {};
  const result = await runPlaceMediaOnlyReplay({
    sourceId: "src-1",
    sourceRecordKey: "wordpress-db:places:5457",
    placeId: "place-1",
    ownerUserId: "user-1",
    candidate,
    sourceHash: null,
    mediaSyncer: fakeSyncer(emptyResult({ imported: 2, reused: 0 }), capture),
  });
  assert.equal(result.status, "APPLIED");
  assert.equal(capture.input?.placeId, "place-1");
  assert.equal(capture.input?.uploadedByUserId, "user-1");
}

async function testRunReportsNoopWhenAllReused() {
  const candidate = { media: { thumbnailAttachmentId: 9001, galleryAttachmentIds: [] } } as never;
  const result = await runPlaceMediaOnlyReplay({
    sourceId: "src-1",
    sourceRecordKey: "wordpress-db:places:5457",
    placeId: "place-1",
    ownerUserId: "user-1",
    candidate,
    sourceHash: null,
    mediaSyncer: fakeSyncer(emptyResult({ imported: 0, reused: 1 })),
  });
  assert.equal(result.status, "NOOP_ALREADY_SYNCED");
}

async function testRunReportsPartialOnMixedOutcome() {
  const candidate = { media: { thumbnailAttachmentId: 9001, galleryAttachmentIds: [9002] } } as never;
  const result = await runPlaceMediaOnlyReplay({
    sourceId: "src-1",
    sourceRecordKey: "wordpress-db:places:5457",
    placeId: "place-1",
    ownerUserId: "user-1",
    candidate,
    sourceHash: null,
    mediaSyncer: fakeSyncer(emptyResult({ imported: 1, failed: 1 })),
  });
  assert.equal(result.status, "PARTIAL");
  if (result.status === "PARTIAL") assert.equal(result.failed, 1);
}

async function main() {
  testParsesValidPlaceSourceRecordKey();
  testRejectsNonPlaceSourceRecordKey();
  testArgsAcceptsValidCombo();
  testArgsRejectsWrongEntity();
  testArgsRejectsWrongSourceRecordKeyCount();
  testArgsRejectsNonFullMediaPolicy();
  testArgsRejectsCombinationWithOtherForceFlags();
  testRuntimeRejectsMissingSource();
  testRuntimeRejectsMissingOrInactiveLineage();
  testRuntimeRejectsMissingTarget();
  testRuntimeAcceptsValidStateAndNormalizes();
  await testRunRefusesWhenNoSourceMedia();
  await testRunRefusesWhenOwnerMissing();
  await testRunReportsAppliedOnNewImports();
  await testRunReportsNoopWhenAllReused();
  await testRunReportsPartialOnMixedOutcome();
  console.log("placeMediaOnlyReplay.test.ts: all tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
