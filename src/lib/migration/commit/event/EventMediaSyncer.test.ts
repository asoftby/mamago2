import assert from "node:assert/strict";

import { EventMediaSyncer, type EventMediaSyncerPrismaClient } from "./EventMediaSyncer";
import type { NormalizedEventCandidate } from "./types";
import type { WordPressAttachmentRow } from "../../adapters/wordpress-db/types";
import type { MediaImporterLike } from "../../media/types";

type GalleryRow = {
  activityId: string;
  mediaAssetId: string | null;
  url: string;
  sortOrder: number;
};

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

function createHarness(options: { failImportIds?: readonly number[]; existingMediaIds?: readonly number[] } = {}) {
  const assets = new Map<string, { id: string; publicUrl: string; deletedAt: null }>();
  const lineages = new Map<string, string>();
  const rows: GalleryRow[] = [];
  const activityUpdates: unknown[] = [];
  for (const id of options.existingMediaIds ?? []) {
    const mediaId = `media-${id}`;
    assets.set(mediaId, { id: mediaId, publicUrl: `/uploads/${id}.webp`, deletedAt: null });
    lineages.set(`wordpress-db:attachment:${id}`, mediaId);
  }

  const prisma: EventMediaSyncerPrismaClient = {
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
  const importedUrls = new Map<string, string>();
  const importer: MediaImporterLike = {
    importFromUrl: async (input) => {
      const id = Number(input.sourceRecordKey.split(":").pop());
      if (options.failImportIds?.includes(id)) {
        throw new Error(`download failed for ${id}`);
      }
      const mediaId = `media-${id}`;
      const publicUrl = `/uploads/${id}.webp`;
      importedUrls.set(input.sourceRecordKey, publicUrl);
      assets.set(mediaId, { id: mediaId, publicUrl, deletedAt: null });
      return { mediaId, storageKey: publicUrl, publicUrl };
    },
  };
  const lineageCalls: unknown[] = [];
  const syncer = new EventMediaSyncer({
    prisma,
    attachmentResolver: {
      getAttachmentsByIds: async (ids) => new Map(ids.flatMap((id) => {
        const row = attachments.get(id);
        return row ? [[id, row] as const] : [];
      })),
    },
    mediaImporterFactory: () => importer,
    lineageWriter: {
      createLineage: async (input) => {
        lineageCalls.push(input);
        lineages.set(input.sourceRecordKey, input.targetId);
        return { lineageId: `lineage-${lineageCalls.length}`, sourceRecordKey: input.sourceRecordKey, targetType: input.targetType, targetId: input.targetId };
      },
    },
  });

  return { syncer, rows, activityUpdates, lineageCalls, attachments, importedUrls };
}

function syncInput(overrides: Partial<Parameters<EventMediaSyncer["sync"]>[0]> = {}) {
  return {
    activityId: "activity-1",
    candidate: candidateFixture(),
    ownerUserId: "user-1",
    sourceId: "source-1",
    sourceHash: "event-hash",
    runId: "run-1",
    recordId: "record-1",
    sourceRecordKey: "wordpress-db:events:401",
    ...overrides,
  };
}

async function testCoverAndGalleryImportedAndLinked() {
  const { syncer, rows, activityUpdates, lineageCalls } = createHarness();

  const result = await syncer.sync(syncInput());

  assert.equal(activityUpdates.length, 1);
  assert.deepEqual((activityUpdates[0] as { data: Record<string, unknown> }).data, {
    coverImageId: "media-10",
    coverImageUrl: "/uploads/10.webp",
  });
  assert.deepEqual(rows, [
    { activityId: "activity-1", mediaAssetId: "media-11", url: "/uploads/11.webp", sortOrder: 0 },
    { activityId: "activity-1", mediaAssetId: "media-12", url: "/uploads/12.webp", sortOrder: 1 },
  ]);
  assert.equal(lineageCalls.length, 3);
  assert.ok(result.warnings.some((w) => w.code === "EVENT_COVER_IMPORTED"));
  assert.ok(result.warnings.some((w) => w.code === "EVENT_GALLERY_IMPORTED"));
}

async function testRepeatedUpdateReusesLineageAndDoesNotDuplicateGallery() {
  const { syncer, rows, lineageCalls } = createHarness();

  await syncer.sync(syncInput());
  const second = await syncer.sync(syncInput());

  assert.equal(rows.length, 2);
  assert.equal(lineageCalls.length, 3, "second run must reuse existing MEDIA_ASSET lineage");
  assert.ok(second.warnings.some((w) => w.code === "EVENT_MEDIA_DEDUP_REUSED"));
}

async function testMissingOwnerSkipsMedia() {
  const { syncer, rows, activityUpdates } = createHarness();

  const result = await syncer.sync(syncInput({ ownerUserId: null }));

  assert.deepEqual(rows, []);
  assert.equal(activityUpdates.length, 0);
  assert.ok(result.warnings.some((w) => w.code === "EVENT_MEDIA_OWNER_MISSING"));
}

async function testFailedDownloadWarnsAndKeepsOtherMedia() {
  const { syncer, rows, activityUpdates } = createHarness({ failImportIds: [11] });

  const result = await syncer.sync(syncInput());

  assert.equal(activityUpdates.length, 1);
  assert.deepEqual(rows, [
    { activityId: "activity-1", mediaAssetId: "media-12", url: "/uploads/12.webp", sortOrder: 0 },
  ]);
  assert.ok(result.warnings.some((w) => w.code === "EVENT_MEDIA_DOWNLOAD_FAILED"));
}

async function testMissingAttachmentWarnsAndDoesNotFail() {
  const { syncer, attachments, rows } = createHarness();
  attachments.delete(12);

  const result = await syncer.sync(syncInput());

  assert.deepEqual(rows, [
    { activityId: "activity-1", mediaAssetId: "media-11", url: "/uploads/11.webp", sortOrder: 0 },
  ]);
  assert.ok(result.warnings.some((w) => w.code === "EVENT_MEDIA_ATTACHMENT_MISSING"));
}

async function testNoMediaEvidenceClearsCoverAndGallery() {
  const { syncer, rows, activityUpdates } = createHarness();
  rows.push({ activityId: "activity-1", mediaAssetId: "old-media", url: "/uploads/old.webp", sortOrder: 0 });

  const result = await syncer.sync(
    syncInput({
      candidate: candidateFixture({ media: { featuredAttachmentId: null, galleryAttachmentIds: [] } }),
    }),
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(rows, []);
  assert.deepEqual((activityUpdates[0] as { data: Record<string, unknown> }).data, {
    coverImageId: null,
    coverImageUrl: null,
  });
}

async function main() {
  await testCoverAndGalleryImportedAndLinked();
  await testRepeatedUpdateReusesLineageAndDoesNotDuplicateGallery();
  await testMissingOwnerSkipsMedia();
  await testFailedDownloadWarnsAndKeepsOtherMedia();
  await testMissingAttachmentWarnsAndDoesNotFail();
  await testNoMediaEvidenceClearsCoverAndGallery();
}

main()
  .then(() => {
    console.log("EventMediaSyncer tests: OK");
  })
  .catch((error) => {
    console.error("EventMediaSyncer tests: FAILED", error);
    process.exitCode = 1;
  });
