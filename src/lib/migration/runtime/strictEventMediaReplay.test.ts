/**
 * Run: tsx src/lib/migration/runtime/strictEventMediaReplay.test.ts (assert-based, project convention).
 *
 * Uses the real `EventMediaSyncer` (not a fake) as the `mediaImporter` for
 * most scenarios, so the resolve/import/reuse path exercised here is
 * exactly the one production code runs — only `runStrictEventMediaReplay`'s
 * own preflight/divergence/atomic-apply logic is under test. The fake
 * `$transaction` genuinely stages writes and only commits them if the
 * callback resolves without throwing — real atomicity, not just a
 * pass-through — so rollback tests are actually proving something.
 */
import assert from "node:assert/strict";

import { EventMediaSyncer, type EventMediaSyncerPrismaClient } from "../commit/event/EventMediaSyncer";
import type { NormalizedEventCandidate } from "../commit/event/types";
import type { WordPressAttachmentRow } from "../adapters/wordpress-db/types";
import type { MediaImporterLike } from "../media/types";
import {
  runStrictEventMediaReplay,
  type StrictEventMediaReplayPrismaClient,
  type StrictEventMediaReplayTxClient,
} from "./strictEventMediaReplay";

type GalleryRow = { activityId: string; mediaAssetId: string | null; url: string; sortOrder: number };
type MediaAssetRow = { id: string; publicUrl: string; deletedAt: null };

function attachment(id: number, overrides: Partial<WordPressAttachmentRow> = {}): WordPressAttachmentRow {
  return {
    ID: id,
    post_title: `Attachment ${id}`,
    post_name: `attachment-${id}`,
    post_mime_type: "image/jpeg",
    guid: `https://wp.example.com/${id}.jpg`,
    post_parent: 401,
    attached_file: null,
    ...overrides,
  };
}

function candidateFixture(overrides: Partial<NormalizedEventCandidate> = {}): NormalizedEventCandidate {
  return {
    title: "Kids Fest",
    slug: "kids-fest",
    content: "<p>Event desc</p>",
    excerpt: "A fun kids event",
    status: "publish",
    publishedAt: "2026-01-01 00:00:00",
    modifiedAt: "2026-01-02 00:00:00",
    eventDatesRaw: ["2026-08-15 10:00:00"],
    scheduleDraft: { mode: "ONE_TIME", dates: ["2026-08-15"] },
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
    media: { featuredAttachmentId: 10, galleryAttachmentIds: [11, 12] },
    ...overrides,
  };
}

interface HarnessOptions {
  failImportIds?: readonly number[];
  missingAttachmentIds?: readonly number[];
  invalidUrlIds?: readonly number[];
  existingMediaIds?: readonly number[];
  failGalleryCreateAtIndex?: number;
  failGalleryDelete?: boolean;
}

function createHarness(options: HarnessOptions = {}) {
  const assets = new Map<string, MediaAssetRow>();
  const lineages = new Map<string, string>();
  const activityUpdates: unknown[] = [];

  for (const id of options.existingMediaIds ?? []) {
    const mediaId = `media-${id}`;
    assets.set(mediaId, { id: mediaId, publicUrl: `/uploads/${id}.webp`, deletedAt: null });
    lineages.set(`wordpress-db:attachment:${id}`, mediaId);
  }

  let committedCoverImageId: string | null = null;
  let committedRows: GalleryRow[] = [];

  const eventSyncerPrisma: EventMediaSyncerPrismaClient = {
    activity: {
      update: (async (args: { data: { coverImageId: string | null; coverImageUrl: string | null } }) => {
        // Used only by EventMediaSyncer.sync() in its own (unchanged) tests — not exercised via runStrictEventMediaReplay's path, which goes through the transactional client below.
        committedCoverImageId = args.data.coverImageId;
        return {};
      }) as unknown as EventMediaSyncerPrismaClient["activity"]["update"],
    },
    mediaAsset: {
      findFirst: (async (args: { where: { id?: string; OR?: Array<Record<string, string>> } }) => {
        const id = args.where.id;
        if (id) return assets.get(id) ?? null;
        const ref = args.where.OR?.map((entry) => Object.values(entry)[0]).find((value) => assets.has(value));
        return ref ? assets.get(ref) ?? null : null;
      }) as unknown as EventMediaSyncerPrismaClient["mediaAsset"]["findFirst"],
    },
    migrationLineage: {
      findFirst: (async (args: { where: { sourceRecordKey: string } }) => {
        const mediaId = lineages.get(args.where.sourceRecordKey);
        return mediaId ? { targetId: mediaId } : null;
      }) as unknown as EventMediaSyncerPrismaClient["migrationLineage"]["findFirst"],
    },
    activityImage: {
      deleteMany: (async () => ({ count: 0 })) as unknown as EventMediaSyncerPrismaClient["activityImage"]["deleteMany"],
      create: (async () => ({})) as unknown as EventMediaSyncerPrismaClient["activityImage"]["create"],
      findMany: (async () => []) as unknown as EventMediaSyncerPrismaClient["activityImage"]["findMany"],
    },
  };

  const attachments = new Map<number, WordPressAttachmentRow>([
    [10, attachment(10)],
    [11, attachment(11)],
    [12, attachment(12)],
  ]);
  for (const id of options.missingAttachmentIds ?? []) attachments.delete(id);
  for (const id of options.invalidUrlIds ?? []) attachments.set(id, attachment(id, { guid: "not-a-url" }));

  const importer: MediaImporterLike = {
    importFromUrl: async (input) => {
      const id = Number(input.sourceRecordKey.split(":").pop());
      if (options.failImportIds?.includes(id)) {
        throw new Error(`download failed for ${id}`);
      }
      const mediaId = `media-${id}`;
      const publicUrl = `/uploads/${id}.webp`;
      assets.set(mediaId, { id: mediaId, publicUrl, deletedAt: null });
      return { mediaId, storageKey: publicUrl, publicUrl };
    },
  };

  const eventMediaSyncer = new EventMediaSyncer({
    prisma: eventSyncerPrisma,
    attachmentResolver: {
      getAttachmentsByIds: async (ids) =>
        new Map(ids.flatMap((id) => {
          const row = attachments.get(id);
          return row ? [[id, row] as const] : [];
        })),
    },
    mediaImporterFactory: () => importer,
    lineageWriter: {
      createLineage: async (input) => {
        lineages.set(input.sourceRecordKey, input.targetId);
        return { lineageId: `lineage-${lineages.size}`, sourceRecordKey: input.sourceRecordKey, targetType: input.targetType, targetId: input.targetId };
      },
    },
  });

  function makeTxClient(staged: { coverImageId: string | null; rows: GalleryRow[] }): StrictEventMediaReplayTxClient {
    let createCallCount = 0;
    return {
      activity: {
        findUnique: (async () => ({ coverImageId: staged.coverImageId })) as unknown as StrictEventMediaReplayTxClient["activity"]["findUnique"],
        update: (async (args: { data: { coverImageId: string | null } }) => {
          activityUpdates.push(args);
          staged.coverImageId = args.data.coverImageId;
          return {};
        }) as unknown as StrictEventMediaReplayTxClient["activity"]["update"],
      },
      activityImage: {
        findMany: (async () => staged.rows) as unknown as StrictEventMediaReplayTxClient["activityImage"]["findMany"],
        deleteMany: (async () => {
          if (options.failGalleryDelete) throw new Error("simulated gallery delete failure");
          staged.rows = [];
          return { count: 0 };
        }) as unknown as StrictEventMediaReplayTxClient["activityImage"]["deleteMany"],
        create: (async (args: { data: GalleryRow }) => {
          if (options.failGalleryCreateAtIndex !== undefined && createCallCount === options.failGalleryCreateAtIndex) {
            createCallCount += 1;
            throw new Error("simulated gallery create failure");
          }
          createCallCount += 1;
          staged.rows.push(args.data);
          return { ...args.data };
        }) as unknown as StrictEventMediaReplayTxClient["activityImage"]["create"],
      },
      mediaAsset: eventSyncerPrisma.mediaAsset as unknown as StrictEventMediaReplayTxClient["mediaAsset"],
    };
  }

  const strictPrisma: StrictEventMediaReplayPrismaClient = {
    ...makeTxClient({
      get coverImageId() {
        return committedCoverImageId;
      },
      get rows() {
        return committedRows;
      },
      set rows(value: GalleryRow[]) {
        committedRows = value;
      },
    } as unknown as { coverImageId: string | null; rows: GalleryRow[] }),
    $transaction: async <T,>(fn: (tx: StrictEventMediaReplayTxClient) => Promise<T>): Promise<T> => {
      const staged = { coverImageId: committedCoverImageId, rows: [...committedRows] };
      const tx = makeTxClient(staged);
      const result = await fn(tx);
      committedCoverImageId = staged.coverImageId;
      committedRows = staged.rows;
      return result;
    },
  };

  return {
    eventMediaSyncer,
    strictPrisma,
    activityUpdates,
    assets,
    getCommittedCoverImageId: () => committedCoverImageId,
    getCommittedRows: () => committedRows,
    setCommittedState: (coverImageId: string | null, rows: GalleryRow[]) => {
      committedCoverImageId = coverImageId;
      committedRows = rows;
    },
  };
}

type ReplayInputOverrides = Partial<Omit<Parameters<typeof runStrictEventMediaReplay>[0], "mediaImporter" | "prisma">> &
  Pick<Parameters<typeof runStrictEventMediaReplay>[0], "mediaImporter" | "prisma">;

function replayInput(overrides: ReplayInputOverrides): Parameters<typeof runStrictEventMediaReplay>[0] {
  return {
    activityId: "activity-1",
    candidate: candidateFixture(),
    ownerUserId: "user-1",
    sourceId: "source-1",
    sourceHash: "hash-1",
    current: { coverImageId: null, galleryMediaAssetIds: [] },
    ...overrides,
  };
}

async function testUnknownExistingCoverRejectsBeforeAnyImport() {
  const { eventMediaSyncer, strictPrisma, activityUpdates } = createHarness();
  let importCalls = 0;
  const wrappedImporter = {
    findExistingMediaAssets: eventMediaSyncer.findExistingMediaAssets.bind(eventMediaSyncer),
    resolveAndImportAttachments: async (input: Parameters<typeof eventMediaSyncer.resolveAndImportAttachments>[0]) => {
      importCalls += 1;
      return eventMediaSyncer.resolveAndImportAttachments(input);
    },
  };
  const result = await runStrictEventMediaReplay(
    replayInput({
      current: { coverImageId: "media-manual-upload", galleryMediaAssetIds: [] },
      mediaImporter: wrappedImporter,
      prisma: strictPrisma,
    }),
  );
  assert.equal(result.status, "REFUSED");
  if (result.status === "REFUSED") assert.equal(result.code, "EVENT_MEDIA_ONLY_TARGET_MEDIA_DIVERGENCE");
  assert.equal(importCalls, 0, "resolveAndImportAttachments (and therefore any download) must never be called");
  assert.equal(activityUpdates.length, 0);
}

async function testUnknownExistingGalleryRejectsBeforeAnyImport() {
  const { eventMediaSyncer, strictPrisma, activityUpdates } = createHarness();
  let importCalls = 0;
  const wrappedImporter = {
    findExistingMediaAssets: eventMediaSyncer.findExistingMediaAssets.bind(eventMediaSyncer),
    resolveAndImportAttachments: async (input: Parameters<typeof eventMediaSyncer.resolveAndImportAttachments>[0]) => {
      importCalls += 1;
      return eventMediaSyncer.resolveAndImportAttachments(input);
    },
  };
  const result = await runStrictEventMediaReplay(
    replayInput({
      current: { coverImageId: null, galleryMediaAssetIds: ["media-manual-gallery-item"] },
      mediaImporter: wrappedImporter,
      prisma: strictPrisma,
    }),
  );
  assert.equal(result.status, "REFUSED");
  if (result.status === "REFUSED") assert.equal(result.code, "EVENT_MEDIA_ONLY_TARGET_MEDIA_DIVERGENCE");
  assert.equal(importCalls, 0);
  assert.equal(activityUpdates.length, 0);
}

async function testAlreadyProvenSyncedIsNoopWithoutImport() {
  const { eventMediaSyncer, strictPrisma, activityUpdates } = createHarness({ existingMediaIds: [10, 11, 12] });
  let importCalls = 0;
  const wrappedImporter = {
    findExistingMediaAssets: eventMediaSyncer.findExistingMediaAssets.bind(eventMediaSyncer),
    resolveAndImportAttachments: async (input: Parameters<typeof eventMediaSyncer.resolveAndImportAttachments>[0]) => {
      importCalls += 1;
      return eventMediaSyncer.resolveAndImportAttachments(input);
    },
  };
  const result = await runStrictEventMediaReplay(
    replayInput({
      current: { coverImageId: "media-10", galleryMediaAssetIds: ["media-11", "media-12"] },
      mediaImporter: wrappedImporter,
      prisma: strictPrisma,
    }),
  );
  assert.equal(result.status, "NOOP_ALREADY_SYNCED");
  assert.equal(importCalls, 0, "no import/download attempt needed when already proven-synced");
  assert.equal(activityUpdates.length, 0);
}

async function testEmptyTargetAllowsImportEvent56062HappyPath() {
  const { eventMediaSyncer, strictPrisma, activityUpdates, getCommittedCoverImageId, getCommittedRows } = createHarness();
  const result = await runStrictEventMediaReplay(
    replayInput({
      candidate: candidateFixture({ media: { featuredAttachmentId: 10, galleryAttachmentIds: [] } }),
      mediaImporter: eventMediaSyncer,
      prisma: strictPrisma,
    }),
  );
  assert.equal(result.status, "APPLIED");
  if (result.status === "APPLIED") assert.equal(result.coverMediaId, "media-10");
  assert.equal(activityUpdates.length, 1);
  assert.equal(getCommittedCoverImageId(), "media-10");
  assert.deepEqual(getCommittedRows(), []);
}

// The apply/transaction phase is only ever reached when the current target
// is fully empty (a non-empty target must fully match proven source media,
// which is exactly the NOOP condition — see testAlreadyProvenSyncedIsNoopWithoutImport)
// or fully unproven (already refused earlier). So a rollback test's "before"
// state is always empty; what varies is *which* step of the gallery replace
// sequence fails — both must still roll back to that same empty state,
// including the cover write that already happened earlier in the same
// transaction.

async function testCoverAppliesThenGalleryFailsRollsBackEntirely() {
  const { eventMediaSyncer, strictPrisma, getCommittedCoverImageId, getCommittedRows } = createHarness({
    failGalleryCreateAtIndex: 1, // first gallery row (media-11) succeeds, second (media-12) fails
  });

  await assert.rejects(() =>
    runStrictEventMediaReplay(
      replayInput({
        current: { coverImageId: null, galleryMediaAssetIds: [] },
        mediaImporter: eventMediaSyncer,
        prisma: strictPrisma,
      }),
    ),
  );

  assert.equal(getCommittedCoverImageId(), null, "cover write must roll back with the rest of the transaction");
  assert.deepEqual(getCommittedRows(), [], "no partial gallery row (not even the one that succeeded) may survive a failed transaction");
}

async function testGalleryDeleteSucceedsThenCreateFailsRollsBackAllRows() {
  const { eventMediaSyncer, strictPrisma, getCommittedCoverImageId, getCommittedRows } = createHarness({
    failGalleryCreateAtIndex: 0, // deleteMany (of nothing) succeeds, the very first create fails
  });

  await assert.rejects(() =>
    runStrictEventMediaReplay(
      replayInput({
        current: { coverImageId: null, galleryMediaAssetIds: [] },
        mediaImporter: eventMediaSyncer,
        prisma: strictPrisma,
      }),
    ),
  );

  assert.equal(getCommittedCoverImageId(), null);
  assert.deepEqual(getCommittedRows(), [], "must roll back to the original (empty) state, not a half-created gallery");
}

async function testTargetChangedDuringReplayRefusesAndRollsBack() {
  const { eventMediaSyncer, strictPrisma, setCommittedState, getCommittedCoverImageId, getCommittedRows } = createHarness();
  // Simulate a concurrent manual edit that lands between the preflight
  // snapshot (input.current, taken by the caller before this call) and
  // the transaction's own live re-check.
  setCommittedState("media-concurrent-manual-edit", []);

  const result = await runStrictEventMediaReplay(
    replayInput({
      current: { coverImageId: null, galleryMediaAssetIds: [] },
      mediaImporter: eventMediaSyncer,
      prisma: strictPrisma,
    }),
  );

  assert.equal(result.status, "REFUSED");
  if (result.status === "REFUSED") assert.equal(result.code, "EVENT_MEDIA_ONLY_TARGET_CHANGED_DURING_REPLAY");
  assert.equal(getCommittedCoverImageId(), "media-concurrent-manual-edit", "the concurrent edit must survive untouched");
  assert.deepEqual(getCommittedRows(), []);
}

async function testSuccessfulCoverAndGalleryAppliedInOneTransactionWithOrder() {
  const { eventMediaSyncer, strictPrisma, getCommittedCoverImageId, getCommittedRows } = createHarness();
  const result = await runStrictEventMediaReplay(replayInput({ mediaImporter: eventMediaSyncer, prisma: strictPrisma }));
  assert.equal(result.status, "APPLIED");
  assert.equal(getCommittedCoverImageId(), "media-10");
  assert.deepEqual(getCommittedRows(), [
    { activityId: "activity-1", mediaAssetId: "media-11", url: "/uploads/11.webp", sortOrder: 0 },
    { activityId: "activity-1", mediaAssetId: "media-12", url: "/uploads/12.webp", sortOrder: 1 },
  ]);
}

async function testRepeatedReplayIsNoopWithZeroDuplicates() {
  const { eventMediaSyncer, strictPrisma, getCommittedCoverImageId, getCommittedRows } = createHarness();
  const first = await runStrictEventMediaReplay(replayInput({ mediaImporter: eventMediaSyncer, prisma: strictPrisma }));
  assert.equal(first.status, "APPLIED");
  const rowsAfterFirst = getCommittedRows().length;

  const second = await runStrictEventMediaReplay(
    replayInput({
      current: { coverImageId: getCommittedCoverImageId(), galleryMediaAssetIds: getCommittedRows().map((r) => r.mediaAssetId) },
      mediaImporter: eventMediaSyncer,
      prisma: strictPrisma,
    }),
  );
  assert.equal(second.status, "NOOP_ALREADY_SYNCED");
  assert.equal(getCommittedRows().length, rowsAfterFirst, "no duplicate gallery rows on a repeated replay");
}

async function testFailedAttachmentImportLeavesTargetUntouched() {
  const { eventMediaSyncer, strictPrisma, activityUpdates, getCommittedCoverImageId, getCommittedRows } = createHarness({
    missingAttachmentIds: [12],
  });
  const result = await runStrictEventMediaReplay(replayInput({ mediaImporter: eventMediaSyncer, prisma: strictPrisma }));
  assert.equal(result.status, "FAILED");
  if (result.status === "FAILED") {
    assert.ok(result.failures.some((f) => f.attachmentId === 12 && f.code === "EVENT_MEDIA_ATTACHMENT_MISSING"));
  }
  assert.equal(activityUpdates.length, 0);
  assert.equal(getCommittedCoverImageId(), null);
  assert.deepEqual(getCommittedRows(), []);
}

async function testSourceMediaMissingRejectsWithoutTouchingTarget() {
  const { eventMediaSyncer, strictPrisma, activityUpdates } = createHarness();
  const result = await runStrictEventMediaReplay(
    replayInput({
      candidate: candidateFixture({ media: { featuredAttachmentId: null, galleryAttachmentIds: [] } }),
      mediaImporter: eventMediaSyncer,
      prisma: strictPrisma,
    }),
  );
  assert.equal(result.status, "REFUSED");
  if (result.status === "REFUSED") assert.equal(result.code, "EVENT_MEDIA_ONLY_SOURCE_MEDIA_MISSING");
  assert.equal(activityUpdates.length, 0);
}

async function testOwnerMissingRejectsWithoutTouchingTarget() {
  const { eventMediaSyncer, strictPrisma, activityUpdates } = createHarness();
  const result = await runStrictEventMediaReplay(
    replayInput({ ownerUserId: null, mediaImporter: eventMediaSyncer, prisma: strictPrisma }),
  );
  assert.equal(result.status, "REFUSED");
  if (result.status === "REFUSED") assert.equal(result.code, "EVENT_MEDIA_OWNER_MISSING");
  assert.equal(activityUpdates.length, 0);
}

// ---------------------------------------------------------------------------
// Gallery normalization — cover excluded, duplicates deduped preserving
// order, consistently across preflight/NOOP/apply/result.
// ---------------------------------------------------------------------------

async function testCoverAlsoPresentInGalleryIsExcludedFromGallery() {
  const { eventMediaSyncer, strictPrisma, getCommittedCoverImageId, getCommittedRows } = createHarness();
  const result = await runStrictEventMediaReplay(
    replayInput({
      candidate: candidateFixture({ media: { featuredAttachmentId: 10, galleryAttachmentIds: [10, 11] } }),
      mediaImporter: eventMediaSyncer,
      prisma: strictPrisma,
    }),
  );
  assert.equal(result.status, "APPLIED");
  if (result.status === "APPLIED") {
    assert.deepEqual(result.galleryMediaIds, ["media-11"], "the cover's own attachment id must never also appear in the gallery result");
  }
  assert.equal(getCommittedCoverImageId(), "media-10");
  assert.deepEqual(getCommittedRows(), [{ activityId: "activity-1", mediaAssetId: "media-11", url: "/uploads/11.webp", sortOrder: 0 }]);
}

async function testDuplicateGalleryAttachmentIdsAreDeduped() {
  const { eventMediaSyncer, strictPrisma, getCommittedRows } = createHarness();
  const result = await runStrictEventMediaReplay(
    replayInput({
      candidate: candidateFixture({ media: { featuredAttachmentId: 10, galleryAttachmentIds: [11, 11, 12] } }),
      mediaImporter: eventMediaSyncer,
      prisma: strictPrisma,
    }),
  );
  assert.equal(result.status, "APPLIED");
  if (result.status === "APPLIED") {
    assert.deepEqual(result.galleryMediaIds, ["media-11", "media-12"], "a duplicate attachment id must produce exactly one gallery row, order preserved");
  }
  assert.deepEqual(getCommittedRows(), [
    { activityId: "activity-1", mediaAssetId: "media-11", url: "/uploads/11.webp", sortOrder: 0 },
    { activityId: "activity-1", mediaAssetId: "media-12", url: "/uploads/12.webp", sortOrder: 1 },
  ]);
}

async function testRepeatedReplayOfCoverInGalleryScenarioIsNoop() {
  const { eventMediaSyncer, strictPrisma, getCommittedCoverImageId, getCommittedRows } = createHarness();
  const candidate = candidateFixture({ media: { featuredAttachmentId: 10, galleryAttachmentIds: [10, 11, 11] } });

  const first = await runStrictEventMediaReplay(replayInput({ candidate, mediaImporter: eventMediaSyncer, prisma: strictPrisma }));
  assert.equal(first.status, "APPLIED");

  const second = await runStrictEventMediaReplay(
    replayInput({
      candidate,
      current: { coverImageId: getCommittedCoverImageId(), galleryMediaAssetIds: getCommittedRows().map((r) => r.mediaAssetId) },
      mediaImporter: eventMediaSyncer,
      prisma: strictPrisma,
    }),
  );
  assert.equal(second.status, "NOOP_ALREADY_SYNCED", "the normalized (cover-excluded, deduped) gallery must round-trip identically on a repeat replay");
  assert.equal(getCommittedRows().length, 1, "still exactly one gallery row — no duplicates from either normalization or the repeat run");
}

async function testMissingOutcomeForRequestedAttachmentFailsWithoutTouchingTarget() {
  const { eventMediaSyncer, strictPrisma, activityUpdates, getCommittedCoverImageId, getCommittedRows } = createHarness();
  // A defensive case: the importer's map doesn't cover every requested id
  // (should never happen with the real EventMediaSyncer, but must not be
  // silently treated as success if it ever did).
  const wrappedImporter = {
    findExistingMediaAssets: eventMediaSyncer.findExistingMediaAssets.bind(eventMediaSyncer),
    resolveAndImportAttachments: async (input: Parameters<typeof eventMediaSyncer.resolveAndImportAttachments>[0]) => {
      const outcomes = await eventMediaSyncer.resolveAndImportAttachments(input);
      outcomes.delete(12); // simulate a missing outcome for one requested attachment
      return outcomes;
    },
  };
  const result = await runStrictEventMediaReplay(replayInput({ mediaImporter: wrappedImporter, prisma: strictPrisma }));
  assert.equal(result.status, "FAILED");
  if (result.status === "FAILED") {
    assert.ok(result.failures.some((f) => f.attachmentId === 12 && f.code === "EVENT_MEDIA_ONLY_OUTCOME_MISSING"));
  }
  assert.equal(activityUpdates.length, 0);
  assert.equal(getCommittedCoverImageId(), null);
  assert.deepEqual(getCommittedRows(), []);
}

async function main() {
  await testUnknownExistingCoverRejectsBeforeAnyImport();
  await testUnknownExistingGalleryRejectsBeforeAnyImport();
  await testAlreadyProvenSyncedIsNoopWithoutImport();
  await testEmptyTargetAllowsImportEvent56062HappyPath();
  await testCoverAppliesThenGalleryFailsRollsBackEntirely();
  await testGalleryDeleteSucceedsThenCreateFailsRollsBackAllRows();
  await testTargetChangedDuringReplayRefusesAndRollsBack();
  await testSuccessfulCoverAndGalleryAppliedInOneTransactionWithOrder();
  await testRepeatedReplayIsNoopWithZeroDuplicates();
  await testFailedAttachmentImportLeavesTargetUntouched();
  await testSourceMediaMissingRejectsWithoutTouchingTarget();
  await testOwnerMissingRejectsWithoutTouchingTarget();

  await testCoverAlsoPresentInGalleryIsExcludedFromGallery();
  await testDuplicateGalleryAttachmentIdsAreDeduped();
  await testRepeatedReplayOfCoverInGalleryScenarioIsNoop();
  await testMissingOutcomeForRequestedAttachmentFailsWithoutTouchingTarget();
}

main()
  .then(() => {
    console.log("strictEventMediaReplay tests: OK");
  })
  .catch((error) => {
    console.error("strictEventMediaReplay tests: FAILED", error);
    process.exitCode = 1;
  });
