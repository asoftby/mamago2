/**
 * Run: tsx src/lib/migration/runtime/eventMediaOnlyReprocess.test.ts (assert-based, project convention).
 */
import assert from "node:assert/strict";

import { CANONICAL_SOURCE_HASH_VERSION, hashEventBundle } from "../adapters/wordpress-db/canonicalSourceHash";
import type { AttachmentImportOutcome } from "../commit/event/EventMediaSyncer";
import type { WordPressEventBundle, WordPressPostRow } from "../adapters/wordpress-db/types";
import type { NormalizedEventCandidate } from "../commit/event/types";
import {
  parseEventPostIdFromSourceRecordKey,
  runEventMediaOnlyReprocess,
  validateEventMediaOnlyReprocessArgs,
  validateEventMediaOnlyReprocessRuntime,
} from "./eventMediaOnlyReprocess";
import type { StrictEventMediaImporter, StrictEventMediaReplayPrismaClient } from "./strictEventMediaReplay";

// ---------------------------------------------------------------------------
// parseEventPostIdFromSourceRecordKey
// ---------------------------------------------------------------------------

function testParsesValidEventSourceRecordKey() {
  assert.equal(parseEventPostIdFromSourceRecordKey("wordpress-db:events:56062"), 56062);
}

function testRejectsNonEventSourceRecordKey() {
  assert.equal(parseEventPostIdFromSourceRecordKey("wordpress-db:places:56062"), null);
  assert.equal(parseEventPostIdFromSourceRecordKey("wordpress-db:events:abc"), null);
  assert.equal(parseEventPostIdFromSourceRecordKey("not-a-key"), null);
}

// ---------------------------------------------------------------------------
// validateEventMediaOnlyReprocessArgs — pure CLI-flag guards.
// ---------------------------------------------------------------------------

function validArgs(overrides: Partial<Parameters<typeof validateEventMediaOnlyReprocessArgs>[0]> = {}) {
  return {
    entity: "event",
    sourceRecordKeyCount: 1,
    mediaPolicyName: "FULL" as const,
    forceReprocess: false,
    ...overrides,
  };
}

function testAcceptsEventSourceKeyFullNoForceReprocess() {
  const result = validateEventMediaOnlyReprocessArgs(validArgs());
  assert.deepEqual(result, { ok: true });
}

function testRejectsNonEventEntity() {
  for (const entity of ["article", "place", "route", "all"]) {
    const result = validateEventMediaOnlyReprocessArgs(validArgs({ entity }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /--entity event/);
  }
}

function testRejectsMissingSourceRecordKey() {
  const result = validateEventMediaOnlyReprocessArgs(validArgs({ sourceRecordKeyCount: 0 }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /exactly one --source-record-key/);
}

function testRejectsMultipleSourceRecordKeys() {
  const result = validateEventMediaOnlyReprocessArgs(validArgs({ sourceRecordKeyCount: 2 }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /exactly one --source-record-key/);
}

function testRejectsNonFullMediaPolicy() {
  for (const mediaPolicyName of ["METADATA", "NONE", undefined] as const) {
    const result = validateEventMediaOnlyReprocessArgs(validArgs({ mediaPolicyName }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /--media-policy FULL/);
  }
}

function testRejectsCombinationWithForceReprocess() {
  const result = validateEventMediaOnlyReprocessArgs(validArgs({ forceReprocess: true }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /--force-reprocess/);
}

// ---------------------------------------------------------------------------
// validateEventMediaOnlyReprocessRuntime — DB/source-state guards.
// ---------------------------------------------------------------------------

function post(overrides: Partial<WordPressPostRow> = {}): WordPressPostRow {
  return {
    ID: 56062,
    post_author: 1,
    post_date: "2026-01-01 00:00:00",
    post_content: "<p>Fun</p>",
    post_title: "Kids Fest",
    post_excerpt: "Fun event",
    post_status: "publish",
    post_name: "kids-fest",
    post_modified: "2026-01-02 00:00:00",
    post_parent: 0,
    guid: "https://wp.example.com/?p=56062",
    post_type: "events",
    post_mime_type: "",
    ...overrides,
  };
}

function bundleFixture(overrides: Partial<WordPressEventBundle> = {}): WordPressEventBundle {
  return {
    post: post(),
    postMeta: { _thumbnail_id: ["64511"] },
    terms: [],
    ...overrides,
  };
}

function testRuntimeRejectsMissingSource() {
  const result = validateEventMediaOnlyReprocessRuntime({ bundle: null, lineage: null, targetExists: false });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /No live published WordPress event/);
}

function testRuntimeRejectsMissingOrInactiveLineage() {
  const bundle = bundleFixture();
  const resultMissing = validateEventMediaOnlyReprocessRuntime({ bundle, lineage: null, targetExists: true });
  assert.equal(resultMissing.ok, false);
  if (!resultMissing.ok) assert.match(resultMissing.reason, /No active ACTIVITY lineage/);

  const resultInactive = validateEventMediaOnlyReprocessRuntime({
    bundle,
    lineage: { sourceId: "src-1", isActive: false, targetId: "activity-1", lastSourceHash: `${CANONICAL_SOURCE_HASH_VERSION}:abc` },
    targetExists: true,
  });
  assert.equal(resultInactive.ok, false);
  if (!resultInactive.ok) assert.match(resultInactive.reason, /No active ACTIVITY lineage/);
}

function testRuntimeRejectsMissingTarget() {
  const bundle = bundleFixture();
  const result = validateEventMediaOnlyReprocessRuntime({
    bundle,
    lineage: { sourceId: "src-1", isActive: true, targetId: "activity-1", lastSourceHash: `${CANONICAL_SOURCE_HASH_VERSION}:abc` },
    targetExists: false,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /Target Activity not found/);
}

function testRuntimeRejectsLegacyHashFormat() {
  const bundle = bundleFixture();
  const result = validateEventMediaOnlyReprocessRuntime({
    bundle,
    lineage: { sourceId: "src-1", isActive: true, targetId: "activity-1", lastSourceHash: "abcdef0123456789".repeat(4) },
    targetExists: true,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /canonical wordpress-db-domain-v2 format/);
}

function testRuntimeRejectsMissingHash() {
  const bundle = bundleFixture();
  const result = validateEventMediaOnlyReprocessRuntime({
    bundle,
    lineage: { sourceId: "src-1", isActive: true, targetId: "activity-1", lastSourceHash: null },
    targetExists: true,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /canonical wordpress-db-domain-v2 format/);
}

function testRuntimeRejectsHashMismatch() {
  const bundle = bundleFixture();
  const result = validateEventMediaOnlyReprocessRuntime({
    bundle,
    lineage: {
      sourceId: "src-1",
      isActive: true,
      targetId: "activity-1",
      lastSourceHash: `${CANONICAL_SOURCE_HASH_VERSION}:0000000000000000000000000000000000000000000000000000000000000000`,
    },
    targetExists: true,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /domain source drift detected/);
}

function testRuntimeAcceptsHashMatch() {
  const bundle = bundleFixture();
  const freshHash = hashEventBundle(bundle);
  const result = validateEventMediaOnlyReprocessRuntime({
    bundle,
    lineage: { sourceId: "src-1", isActive: true, targetId: "activity-1", lastSourceHash: freshHash },
    targetExists: true,
    now: new Date("2026-07-20T12:00:00Z"),
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.freshHash, freshHash);
    assert.equal(result.candidate.title, "Kids Fest");
  }
}

// ---------------------------------------------------------------------------
// runEventMediaOnlyReprocess — the entire allowed write surface: one call
// into EventMediaSyncerLike.sync(), nothing else.
// ---------------------------------------------------------------------------

function candidateFixture(overrides: Partial<NormalizedEventCandidate> = {}): NormalizedEventCandidate {
  return {
    title: "Kids Fest",
    slug: "kids-fest",
    content: "<p>Fun</p>",
    excerpt: "Fun event",
    status: "publish",
    publishedAt: "2026-01-01 00:00:00",
    modifiedAt: "2026-01-02 00:00:00",
    eventDatesRaw: [],
    scheduleDraft: null,
    venueNameRaw: null,
    locationRaw: null,
    addressEventPlaceRaw: null,
    cityRaw: null,
    priceRaw: null,
    ticketUrlRaw: null,
    externalEventId: null,
    externalLastUpdatedRaw: null,
    trailerUrlRaw: null,
    seo: { title: null, focusKeyword: null },
    sourceTerms: [],
    rawMeta: {},
    media: { featuredAttachmentId: 64511, galleryAttachmentIds: [] },
    ...overrides,
  };
}

function recordingMediaImporter(outcome: AttachmentImportOutcome): { importer: StrictEventMediaImporter; calls: () => unknown[] } {
  const calls: unknown[] = [];
  const importer: StrictEventMediaImporter = {
    async resolveAndImportAttachments(input) {
      calls.push(input);
      return new Map(input.ids.map((id) => [id, outcome]));
    },
  };
  return { importer, calls: () => calls };
}

function fakePrisma(): StrictEventMediaReplayPrismaClient {
  const activityUpdates: unknown[] = [];
  return {
    activity: {
      update: (async (args: unknown) => {
        activityUpdates.push(args);
        return {};
      }) as unknown as StrictEventMediaReplayPrismaClient["activity"]["update"],
    },
    activityImage: {
      create: (async () => ({})) as unknown as StrictEventMediaReplayPrismaClient["activityImage"]["create"],
      deleteMany: (async () => ({ count: 0 })) as unknown as StrictEventMediaReplayPrismaClient["activityImage"]["deleteMany"],
      findMany: (async () => []) as unknown as StrictEventMediaReplayPrismaClient["activityImage"]["findMany"],
    },
    mediaAsset: {
      findFirst: (async () => ({ id: "media-64511", publicUrl: "/uploads/64511.webp" })) as unknown as StrictEventMediaReplayPrismaClient["mediaAsset"]["findFirst"],
    },
  };
}

async function testRunDelegatesToStrictReplayWithNullRunAndRecordId() {
  const { importer, calls } = recordingMediaImporter({ ok: true, reused: false, mediaId: "media-64511", publicUrl: "/uploads/64511.webp" });
  const result = await runEventMediaOnlyReprocess({
    sourceId: "src-1",
    sourceRecordKey: "wordpress-db:events:56062",
    activityId: "activity-1",
    ownerUserId: "owner-1",
    candidate: candidateFixture(),
    freshHash: `${CANONICAL_SOURCE_HASH_VERSION}:deadbeef`,
    current: { coverImageId: null, galleryMediaAssetIds: [] },
    mediaImporter: importer,
    prisma: fakePrisma(),
  });

  assert.equal(calls().length, 1, "must resolve/import attachments exactly once");
  const call = calls()[0] as Record<string, unknown>;
  assert.equal(call.sourceId, "src-1");
  assert.equal(call.sourceHash, `${CANONICAL_SOURCE_HASH_VERSION}:deadbeef`);
  assert.equal(call.runId, null, "must never attach a MigrationRun — this is a standalone replay");
  assert.equal(call.recordId, null, "must never attach a MigrationRecord — this is a standalone replay");
  assert.equal(result.status, "APPLIED");
  if (result.status === "APPLIED") assert.equal(result.coverMediaId, "media-64511");
}

async function main() {
  testParsesValidEventSourceRecordKey();
  testRejectsNonEventSourceRecordKey();

  testAcceptsEventSourceKeyFullNoForceReprocess();
  testRejectsNonEventEntity();
  testRejectsMissingSourceRecordKey();
  testRejectsMultipleSourceRecordKeys();
  testRejectsNonFullMediaPolicy();
  testRejectsCombinationWithForceReprocess();

  testRuntimeRejectsMissingSource();
  testRuntimeRejectsMissingOrInactiveLineage();
  testRuntimeRejectsMissingTarget();
  testRuntimeRejectsLegacyHashFormat();
  testRuntimeRejectsMissingHash();
  testRuntimeRejectsHashMismatch();
  testRuntimeAcceptsHashMatch();

  await testRunDelegatesToStrictReplayWithNullRunAndRecordId();
}

main()
  .then(() => {
    console.log("eventMediaOnlyReprocess tests: OK");
  })
  .catch((error) => {
    console.error("eventMediaOnlyReprocess tests: FAILED", error);
    process.exitCode = 1;
  });
