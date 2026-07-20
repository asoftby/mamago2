/**
 * Run: tsx src/lib/migration/runtime/strictEventMediaReplay.test.ts (assert-based, project convention).
 *
 * Uses the real `EventMediaSyncer` (not a fake) as the `mediaImporter` for
 * most scenarios, so the resolve/import/reuse path exercised here is
 * exactly the one production code runs — only `runStrictEventMediaReplay`'s
 * own fail-closed/divergence/apply logic is under test.
 */
import assert from "node:assert/strict";

import { EventMediaSyncer, type EventMediaSyncerPrismaClient } from "../commit/event/EventMediaSyncer";
import type { NormalizedEventCandidate } from "../commit/event/types";
import type { WordPressAttachmentRow } from "../adapters/wordpress-db/types";
import type { MediaImporterLike } from "../media/types";
import { runStrictEventMediaReplay, type StrictEventMediaReplayPrismaClient } from "./strictEventMediaReplay";

type GalleryRow = { activityId: string; mediaAssetId: string | null; url: string; sortOrder: number };

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

/**
 * Wraps a plain object so any property access outside `allowed` throws —
 * proof-by-construction that `runStrictEventMediaReplay`'s own write phase
 * never reaches `activitySession`/`eventVenue`/`migrationLineage` (the
 * `StrictEventMediaReplayPrismaClient` type doesn't even declare them, but
 * this also catches any accidental runtime access through a wider object).
 */
function guardedPrisma<T extends object>(target: T, allowed: readonly (keyof T)[]): T {
  return new Proxy(target, {
    get(obj, prop) {
      if (!allowed.includes(prop as keyof T)) {
        throw new Error(`Unexpected prisma namespace accessed: ${String(prop)}`);
      }
      return obj[prop as keyof T];
    },
  });
}

function createHarness(options: { failImportIds?: readonly number[]; missingAttachmentIds?: readonly number[]; invalidUrlIds?: readonly number[] } = {}) {
  const assets = new Map<string, { id: string; publicUrl: string; deletedAt: null }>();
  const lineages = new Map<string, string>();
  const rows: GalleryRow[] = [];
  const activityUpdates: unknown[] = [];

  const eventSyncerPrisma: EventMediaSyncerPrismaClient = {
    activity: {
      update: (async (args: unknown) => {
        activityUpdates.push(args);
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
      deleteMany: (async (args: { where: { activityId: string } }) => {
        for (let i = rows.length - 1; i >= 0; i--) {
          if (rows[i]?.activityId === args.where.activityId) rows.splice(i, 1);
        }
        return { count: 0 };
      }) as unknown as EventMediaSyncerPrismaClient["activityImage"]["deleteMany"],
      create: (async (args: { data: GalleryRow }) => {
        rows.push(args.data);
        return { id: `row-${rows.length}`, ...args.data };
      }) as unknown as EventMediaSyncerPrismaClient["activityImage"]["create"],
      findMany: (async () => rows) as unknown as EventMediaSyncerPrismaClient["activityImage"]["findMany"],
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

  const strictPrisma: StrictEventMediaReplayPrismaClient = guardedPrisma(
    {
      activity: eventSyncerPrisma.activity,
      activityImage: eventSyncerPrisma.activityImage,
      mediaAsset: eventSyncerPrisma.mediaAsset,
    },
    ["activity", "activityImage", "mediaAsset"],
  );

  return { eventMediaSyncer, strictPrisma, rows, activityUpdates, assets };
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

async function testSourceMediaMissingRejectsWithoutTouchingTarget() {
  const { eventMediaSyncer, strictPrisma, rows, activityUpdates } = createHarness();
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
  assert.deepEqual(rows, []);
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

async function testMissingAttachmentFailsWithoutTouchingTarget() {
  const { eventMediaSyncer, strictPrisma, activityUpdates, rows } = createHarness({ missingAttachmentIds: [12] });
  const result = await runStrictEventMediaReplay(replayInput({ mediaImporter: eventMediaSyncer, prisma: strictPrisma }));
  assert.equal(result.status, "FAILED");
  if (result.status === "FAILED") {
    assert.ok(result.failures.some((f) => f.attachmentId === 12 && f.code === "EVENT_MEDIA_ATTACHMENT_MISSING"));
  }
  assert.equal(activityUpdates.length, 0);
  assert.deepEqual(rows, []);
}

async function testInvalidUrlFailsWithoutTouchingTarget() {
  const { eventMediaSyncer, strictPrisma, activityUpdates, rows } = createHarness({ invalidUrlIds: [11] });
  const result = await runStrictEventMediaReplay(replayInput({ mediaImporter: eventMediaSyncer, prisma: strictPrisma }));
  assert.equal(result.status, "FAILED");
  if (result.status === "FAILED") {
    assert.ok(result.failures.some((f) => f.attachmentId === 11 && f.code === "EVENT_MEDIA_URL_INVALID"));
  }
  assert.equal(activityUpdates.length, 0);
  assert.deepEqual(rows, []);
}

async function testDownloadFailureCoverLeavesTargetUntouched() {
  const { eventMediaSyncer, strictPrisma, activityUpdates, rows } = createHarness({ failImportIds: [10] });
  const result = await runStrictEventMediaReplay(
    replayInput({
      current: { coverImageId: "media-existing-cover", galleryMediaAssetIds: [] },
      mediaImporter: eventMediaSyncer,
      prisma: strictPrisma,
    }),
  );
  assert.equal(result.status, "FAILED");
  if (result.status === "FAILED") {
    assert.ok(result.failures.some((f) => f.attachmentId === 10 && f.code === "EVENT_MEDIA_DOWNLOAD_FAILED"));
  }
  assert.equal(activityUpdates.length, 0, "existing cover must never be touched on a failed import");
  assert.deepEqual(rows, []);
}

async function testPartialGalleryFailureLeavesEntireGalleryUntouched() {
  const { eventMediaSyncer, strictPrisma, activityUpdates, rows } = createHarness({ failImportIds: [12] });
  rows.push({ activityId: "activity-1", mediaAssetId: "media-11", url: "/uploads/11.webp", sortOrder: 0 });
  const result = await runStrictEventMediaReplay(
    replayInput({
      current: { coverImageId: null, galleryMediaAssetIds: ["media-11"] },
      mediaImporter: eventMediaSyncer,
      prisma: strictPrisma,
    }),
  );
  assert.equal(result.status, "FAILED");
  assert.equal(activityUpdates.length, 0);
  assert.deepEqual(rows, [{ activityId: "activity-1", mediaAssetId: "media-11", url: "/uploads/11.webp", sortOrder: 0 }], "gallery must stay exactly as it was — no partial replacement");
}

async function testExistingUnknownCoverRejectsAsDivergence() {
  const { eventMediaSyncer, strictPrisma, activityUpdates } = createHarness();
  const result = await runStrictEventMediaReplay(
    replayInput({
      current: { coverImageId: "media-manual-upload", galleryMediaAssetIds: [] },
      mediaImporter: eventMediaSyncer,
      prisma: strictPrisma,
    }),
  );
  assert.equal(result.status, "REFUSED");
  if (result.status === "REFUSED") assert.equal(result.code, "EVENT_MEDIA_ONLY_TARGET_MEDIA_DIVERGENCE");
  assert.equal(activityUpdates.length, 0);
}

async function testExistingUnknownGalleryRowRejectsAsDivergence() {
  const { eventMediaSyncer, strictPrisma, activityUpdates, rows } = createHarness();
  rows.push({ activityId: "activity-1", mediaAssetId: "media-manual-gallery-item", url: "/uploads/manual.webp", sortOrder: 0 });
  const result = await runStrictEventMediaReplay(
    replayInput({
      current: { coverImageId: null, galleryMediaAssetIds: ["media-manual-gallery-item"] },
      mediaImporter: eventMediaSyncer,
      prisma: strictPrisma,
    }),
  );
  assert.equal(result.status, "REFUSED");
  if (result.status === "REFUSED") assert.equal(result.code, "EVENT_MEDIA_ONLY_TARGET_MEDIA_DIVERGENCE");
  assert.equal(activityUpdates.length, 0);
  assert.equal(rows.length, 1, "the manual gallery row must survive untouched");
}

async function testEmptyTargetSuccessfulCoverImportApplies() {
  const { eventMediaSyncer, strictPrisma, activityUpdates, rows } = createHarness();
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
  assert.deepEqual((activityUpdates[0] as { data: Record<string, unknown> }).data, {
    coverImageId: "media-10",
    coverImageUrl: "/uploads/10.webp",
  });
  assert.deepEqual(rows, []);
}

async function testFullGalleryImportAppliesCorrectSortOrder() {
  const { eventMediaSyncer, strictPrisma, rows } = createHarness();
  const result = await runStrictEventMediaReplay(replayInput({ mediaImporter: eventMediaSyncer, prisma: strictPrisma }));
  assert.equal(result.status, "APPLIED");
  assert.deepEqual(rows, [
    { activityId: "activity-1", mediaAssetId: "media-11", url: "/uploads/11.webp", sortOrder: 0 },
    { activityId: "activity-1", mediaAssetId: "media-12", url: "/uploads/12.webp", sortOrder: 1 },
  ]);
}

async function testAlreadySyncedIsNoop() {
  const { eventMediaSyncer, strictPrisma, activityUpdates, rows } = createHarness();
  const result = await runStrictEventMediaReplay(
    replayInput({
      current: { coverImageId: "media-10", galleryMediaAssetIds: ["media-11", "media-12"] },
      mediaImporter: eventMediaSyncer,
      prisma: strictPrisma,
    }),
  );
  assert.equal(result.status, "NOOP_ALREADY_SYNCED");
  assert.equal(activityUpdates.length, 0, "must not rewrite an already-correct cover");
  assert.deepEqual(rows, [], "must not touch gallery rows when already synced");
}

async function testRepeatedReplayIsIdempotentNoDuplicates() {
  const { eventMediaSyncer, strictPrisma, rows } = createHarness();
  const first = await runStrictEventMediaReplay(replayInput({ mediaImporter: eventMediaSyncer, prisma: strictPrisma }));
  assert.equal(first.status, "APPLIED");
  const rowsAfterFirst = rows.length;

  // Second run reads the *actual* resulting current state, as a real CLI re-run would.
  const second = await runStrictEventMediaReplay(
    replayInput({
      current: { coverImageId: "media-10", galleryMediaAssetIds: rows.map((r) => r.mediaAssetId) },
      mediaImporter: eventMediaSyncer,
      prisma: strictPrisma,
    }),
  );
  assert.equal(second.status, "NOOP_ALREADY_SYNCED");
  assert.equal(rows.length, rowsAfterFirst, "no duplicate gallery rows on a repeated replay");
}

async function testAppliedResultOnlyTouchesActivityAndActivityImage() {
  // The guardedPrisma() proxy throws on any property access outside
  // activity/activityImage/mediaAsset — this run (the APPLIED path, the
  // only one that writes) proves no other namespace (activitySession,
  // eventVenue, migrationLineage) is ever reached from the strict replay's
  // own write phase. EventMediaSyncer's *internal* migrationLineage use
  // (MEDIA_ASSET dedup only) is on its own separate prisma object, already
  // covered by EventMediaSyncer.test.ts.
  const { eventMediaSyncer, strictPrisma } = createHarness();
  const result = await runStrictEventMediaReplay(replayInput({ mediaImporter: eventMediaSyncer, prisma: strictPrisma }));
  assert.equal(result.status, "APPLIED");
}

async function main() {
  await testSourceMediaMissingRejectsWithoutTouchingTarget();
  await testOwnerMissingRejectsWithoutTouchingTarget();
  await testMissingAttachmentFailsWithoutTouchingTarget();
  await testInvalidUrlFailsWithoutTouchingTarget();
  await testDownloadFailureCoverLeavesTargetUntouched();
  await testPartialGalleryFailureLeavesEntireGalleryUntouched();
  await testExistingUnknownCoverRejectsAsDivergence();
  await testExistingUnknownGalleryRowRejectsAsDivergence();
  await testEmptyTargetSuccessfulCoverImportApplies();
  await testFullGalleryImportAppliesCorrectSortOrder();
  await testAlreadySyncedIsNoop();
  await testRepeatedReplayIsIdempotentNoDuplicates();
  await testAppliedResultOnlyTouchesActivityAndActivityImage();
}

main()
  .then(() => {
    console.log("strictEventMediaReplay tests: OK");
  })
  .catch((error) => {
    console.error("strictEventMediaReplay tests: FAILED", error);
    process.exitCode = 1;
  });
