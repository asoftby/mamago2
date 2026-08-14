import assert from "node:assert/strict";

import {
  RouteStopMediaSyncer,
  uniqueAttachmentIds,
  type RouteStopMediaSyncerPrismaClient,
} from "./RouteStopMediaSyncer";
import type { NormalizedRouteCandidate } from "./buildRouteCreateDraft";
import type { WordPressAttachmentRow } from "../../adapters/wordpress-db/types";
import type { MediaImporterLike } from "../../media/types";

function attachment(id: number, overrides: Partial<WordPressAttachmentRow> = {}): WordPressAttachmentRow {
  return {
    ID: id,
    post_title: `Attachment ${id}`,
    post_name: `attachment-${id}`,
    post_mime_type: "image/jpeg",
    guid: `https://wp.example.com/${id}.jpg`,
    post_parent: 701,
    attached_file: null,
    ...overrides,
  };
}

function candidateFixture(overrides: Partial<NormalizedRouteCandidate> = {}): NormalizedRouteCandidate {
  return {
    title: "Family Route",
    slug: "family-route",
    status: "publish",
    publishedAt: "2026-01-01 00:00:00",
    modifiedAt: "2026-01-02 00:00:00",
    stops: [
      { index: 1, title: "First", description: "First note", imageAttachmentIds: [10], placeId: null },
      { index: 2, title: "Second", description: "Second note", imageAttachmentIds: [11, 12], placeId: null },
    ],
    locationRaw: null,
    location: null,
    media: { featuredAttachmentId: null },
    seo: { title: null, focusKeyword: null },
    sourceTerms: [],
    rawMeta: {},
    ...overrides,
  };
}

function createHarness(options: { failImportIds?: readonly number[]; existingMediaIds?: readonly number[] } = {}) {
  const assets = new Map<string, { id: string; publicUrl: string; deletedAt: null }>();
  const lineages = new Map<string, string>();
  const stopUpdates: unknown[] = [];
  const routeUpdates: unknown[] = [];
  const galleryDeletes: unknown[] = [];
  const galleryCreates: unknown[] = [];
  const importCalls: unknown[] = [];
  const lineageCalls: unknown[] = [];

  for (const id of options.existingMediaIds ?? []) {
    const mediaId = `media-${id}`;
    assets.set(mediaId, { id: mediaId, publicUrl: `/uploads/${id}.webp`, deletedAt: null });
    lineages.set(`wordpress-db:attachment:${id}`, mediaId);
  }

  const prisma: RouteStopMediaSyncerPrismaClient = {
    route: {
      update: (async (args: unknown) => {
        routeUpdates.push(args);
        return { id: "route-1" };
      }) as unknown as RouteStopMediaSyncerPrismaClient["route"]["update"],
    },
    routeStop: {
      updateMany: (async (args: unknown) => {
        stopUpdates.push(args);
        return { count: 1 };
      }) as unknown as RouteStopMediaSyncerPrismaClient["routeStop"]["updateMany"],
      findMany: (async () => [
        { id: "stop-1", order: 1 },
        { id: "stop-2", order: 2 },
      ]) as unknown as RouteStopMediaSyncerPrismaClient["routeStop"]["findMany"],
    },
    routeStopImage: {
      deleteMany: (async (args: unknown) => {
        galleryDeletes.push(args);
        return { count: 0 };
      }) as unknown as RouteStopMediaSyncerPrismaClient["routeStopImage"]["deleteMany"],
      create: (async (args: unknown) => {
        galleryCreates.push(args);
        return { id: `img-${galleryCreates.length}` };
      }) as unknown as RouteStopMediaSyncerPrismaClient["routeStopImage"]["create"],
    },
    mediaAsset: {
      findFirst: (async (args: { where: { id?: string } }) => {
        const id = args.where.id;
        return id ? assets.get(id) ?? null : null;
      }) as unknown as RouteStopMediaSyncerPrismaClient["mediaAsset"]["findFirst"],
    },
    migrationLineage: {
      findFirst: (async (args: { where: { sourceRecordKey: string } }) => {
        const mediaId = lineages.get(args.where.sourceRecordKey);
        return mediaId ? { targetId: mediaId } : null;
      }) as unknown as RouteStopMediaSyncerPrismaClient["migrationLineage"]["findFirst"],
    },
  };

  const attachments = new Map<number, WordPressAttachmentRow>([
    [9, attachment(9)],
    [10, attachment(10)],
    [11, attachment(11)],
    [12, attachment(12)],
  ]);
  const importer: MediaImporterLike = {
    importFromUrl: async (input) => {
      importCalls.push(input);
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

  const syncer = new RouteStopMediaSyncer({
    prisma,
    attachmentResolver: {
      getAttachmentsByIds: async (ids) =>
        new Map(
          ids.flatMap((id) => {
            const row = attachments.get(id);
            return row ? [[id, row] as const] : [];
          }),
        ),
    },
    mediaImporterFactory: () => importer,
    lineageWriter: {
      createLineage: async (input) => {
        lineageCalls.push(input);
        lineages.set(input.sourceRecordKey, input.targetId);
        return {
          lineageId: `lineage-${lineageCalls.length}`,
          sourceRecordKey: input.sourceRecordKey,
          targetType: input.targetType,
          targetId: input.targetId,
        };
      },
    },
  });

  return {
    syncer,
    stopUpdates,
    routeUpdates,
    galleryDeletes,
    galleryCreates,
    importCalls,
    lineageCalls,
    attachments,
  };
}

function syncInput(overrides: Partial<Parameters<RouteStopMediaSyncer["sync"]>[0]> = {}) {
  return {
    routeId: "route-1",
    candidate: candidateFixture(),
    mediaOwnerUserId: "user-1",
    sourceId: "source-1",
    sourceHash: "route-hash",
    runId: "run-1",
    recordId: "record-1",
    sourceRecordKey: "wordpress-db:routes:701",
    ...overrides,
  };
}

function coverUpdate(routeUpdates: unknown[]): { coverImageUrl: string | null } {
  const last = routeUpdates.at(-1) as { data: { coverImageUrl: string | null } };
  return last.data;
}

function galleryForStop(galleryCreates: unknown[], routeStopId: string): { url: string; sortOrder: number }[] {
  return galleryCreates
    .map((row) => (row as { data: { url: string; sortOrder: number; routeStopId: string } }).data)
    .filter((row) => row.routeStopId === routeStopId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

async function testNoStopMediaClearsCoverAndDoesNotImport() {
  const { syncer, importCalls, routeUpdates, galleryCreates } = createHarness();

  const result = await syncer.sync(
    syncInput({
      candidate: candidateFixture({
        stops: [{ index: 1, title: "First", description: null, imageAttachmentIds: [], placeId: null }],
      }),
    }),
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(importCalls, []);
  assert.equal(coverUpdate(routeUpdates).coverImageUrl, null);
  assert.deepEqual(galleryCreates, []);
}

async function testCoverImportedFromThumbnailId() {
  const { syncer, routeUpdates, lineageCalls } = createHarness();

  const result = await syncer.sync(
    syncInput({ candidate: candidateFixture({ media: { featuredAttachmentId: 9 } }) }),
  );

  assert.equal(coverUpdate(routeUpdates).coverImageUrl, "/uploads/9.webp");
  assert.equal(
    (lineageCalls[0] as { targetRole?: string }).targetRole,
    "route-cover",
  );
  assert.ok(result.warnings.some((w) => w.code === "ROUTE_COVER_IMPORTED"));
}

async function testMissingCoverLeavesCoverImageUrlNull() {
  const { syncer, routeUpdates, importCalls } = createHarness();

  const result = await syncer.sync(syncInput());

  assert.equal(coverUpdate(routeUpdates).coverImageUrl, null);
  assert.ok(!result.warnings.some((w) => w.code === "ROUTE_COVER_IMPORTED"));
  assert.ok(importCalls.length > 0, "stop images must still import when cover is absent");
}

async function testSingleAttachmentLinkedToCorrectStopOrder() {
  const { syncer, stopUpdates, lineageCalls } = createHarness();

  const result = await syncer.sync(syncInput());

  assert.equal(lineageCalls.length, 3);
  assert.equal((stopUpdates[0] as { where: { routeId: string; order: number }; data: { photoUrl: string | null } }).where.order, 1);
  assert.equal((stopUpdates[0] as { data: { photoUrl: string | null } }).data.photoUrl, "/uploads/10.webp");
  assert.equal((stopUpdates[1] as { where: { routeId: string; order: number }; data: { photoUrl: string | null } }).where.order, 2);
  assert.equal((stopUpdates[1] as { data: { photoUrl: string | null } }).data.photoUrl, "/uploads/11.webp");
  assert.ok(result.warnings.some((w) => w.code === "ROUTE_STOP_MEDIA_IMPORTED"));
}

async function testMultipleImagesStoredInSourceOrderIncludingFirst() {
  const { syncer, stopUpdates, galleryCreates, importCalls } = createHarness();

  const result = await syncer.sync(syncInput());

  assert.equal((stopUpdates[1] as { data: { photoUrl: string | null } }).data.photoUrl, "/uploads/11.webp");
  assert.ok(importCalls.some((call) => String((call as { sourceRecordKey: string }).sourceRecordKey).endsWith(":12")));
  assert.deepEqual(
    galleryForStop(galleryCreates, "stop-2").map((row) => row.url),
    ["/uploads/11.webp", "/uploads/12.webp"],
  );
  assert.deepEqual(
    galleryForStop(galleryCreates, "stop-1").map((row) => row.url),
    ["/uploads/10.webp"],
  );
  assert.ok(!result.warnings.some((w) => w.code === "ROUTE_STOP_MEDIA_EXTRA_ATTACHMENTS_SKIPPED"));
}

async function testDuplicateSourceAttachmentStoredOnce() {
  const { syncer, galleryCreates, importCalls } = createHarness();

  await syncer.sync(
    syncInput({
      candidate: candidateFixture({
        stops: [{ index: 1, title: "First", description: null, imageAttachmentIds: [10, 10, 11], placeId: null }],
      }),
    }),
  );

  assert.equal(
    importCalls.filter((call) => String((call as { sourceRecordKey: string }).sourceRecordKey).endsWith(":10")).length,
    1,
  );
  assert.deepEqual(
    galleryForStop(galleryCreates, "stop-1").map((row) => ({ url: row.url, sortOrder: row.sortOrder })),
    [
      { url: "/uploads/10.webp", sortOrder: 0 },
      { url: "/uploads/11.webp", sortOrder: 1 },
    ],
  );
}

async function testMissingAttachmentWarnsAndUsesNextValidForSameStop() {
  const { syncer, attachments, stopUpdates, galleryCreates } = createHarness();
  attachments.delete(11);

  const result = await syncer.sync(syncInput());

  assert.equal((stopUpdates[1] as { data: { photoUrl: string | null } }).data.photoUrl, "/uploads/12.webp");
  assert.deepEqual(galleryForStop(galleryCreates, "stop-2").map((row) => row.url), ["/uploads/12.webp"]);
  assert.ok(result.warnings.some((w) => w.code === "ROUTE_STOP_MEDIA_ATTACHMENT_MISSING"));
}

async function testInvalidAttachmentUrlWarnsAndSkips() {
  const { syncer, attachments, stopUpdates } = createHarness();
  attachments.set(10, attachment(10, { guid: "not-a-url" }));

  const result = await syncer.sync(syncInput());

  assert.equal((stopUpdates[0] as { data: { photoUrl: string | null } }).data.photoUrl, null);
  assert.ok(result.warnings.some((w) => w.code === "ROUTE_STOP_MEDIA_URL_INVALID"));
}

async function testRepeatedSyncReusesLineageAndDoesNotDuplicateGallery() {
  const { syncer, importCalls, lineageCalls, routeUpdates, galleryCreates, galleryDeletes } = createHarness();
  const input = syncInput({ candidate: candidateFixture({ media: { featuredAttachmentId: 9 } }) });

  await syncer.sync(input);
  const firstImports = importCalls.length;
  const firstLineages = lineageCalls.length;
  const firstGalleryCreates = galleryCreates.length;
  const second = await syncer.sync(input);

  assert.equal(firstLineages, 4, "cover + three stop images");
  assert.equal(importCalls.length, firstImports, "second run must reuse existing MEDIA_ASSET lineage");
  assert.equal(lineageCalls.length, firstLineages);
  assert.equal(galleryDeletes.length, 4, "each run replaces both stop galleries");
  assert.equal(galleryCreates.length, firstGalleryCreates * 2);
  assert.ok(second.warnings.some((w) => w.code === "ROUTE_STOP_MEDIA_DEDUP_REUSED"));
  assert.equal(coverUpdate(routeUpdates).coverImageUrl, "/uploads/9.webp");
}

async function testCoverAndStopSharingAttachmentDoNotDuplicateLineage() {
  const { syncer, importCalls, lineageCalls, routeUpdates, stopUpdates, galleryCreates } = createHarness();

  const result = await syncer.sync(
    syncInput({ candidate: candidateFixture({ media: { featuredAttachmentId: 10 } }) }),
  );

  const attachmentKeys = lineageCalls.map((call) => (call as { sourceRecordKey: string }).sourceRecordKey);
  assert.deepEqual(
    attachmentKeys.filter((key, index, all) => all.indexOf(key) === index),
    ["wordpress-db:attachment:10", "wordpress-db:attachment:11", "wordpress-db:attachment:12"],
  );
  assert.equal(
    importCalls.filter((call) => String((call as { sourceRecordKey: string }).sourceRecordKey).endsWith(":10")).length,
    1,
  );
  assert.equal(coverUpdate(routeUpdates).coverImageUrl, "/uploads/10.webp");
  assert.equal((stopUpdates[0] as { data: { photoUrl: string | null } }).data.photoUrl, "/uploads/10.webp");
  assert.deepEqual(galleryForStop(galleryCreates, "stop-1").map((row) => row.url), ["/uploads/10.webp"]);
  assert.ok(result.warnings.some((w) => w.code === "ROUTE_STOP_MEDIA_DEDUP_REUSED"));
}

async function testMissingOwnerSkipsMediaWithWarning() {
  const { syncer, stopUpdates, importCalls, routeUpdates, galleryCreates } = createHarness();

  const result = await syncer.sync(syncInput({ mediaOwnerUserId: null }));

  assert.deepEqual(stopUpdates, []);
  assert.deepEqual(importCalls, []);
  assert.deepEqual(routeUpdates, []);
  assert.deepEqual(galleryCreates, []);
  assert.ok(result.warnings.some((w) => w.code === "ROUTE_STOP_MEDIA_OWNER_MISSING"));
}

async function testFailedDownloadDoesNotBlockOtherStopMedia() {
  const { syncer, stopUpdates, galleryCreates } = createHarness({ failImportIds: [10] });

  const result = await syncer.sync(syncInput());

  assert.equal((stopUpdates[0] as { data: { photoUrl: string | null } }).data.photoUrl, null);
  assert.equal((stopUpdates[1] as { data: { photoUrl: string | null } }).data.photoUrl, "/uploads/11.webp");
  assert.deepEqual(galleryForStop(galleryCreates, "stop-1"), []);
  assert.ok(result.warnings.some((w) => w.code === "ROUTE_STOP_MEDIA_DOWNLOAD_FAILED"));
}

async function testMissingCoverAttachmentWarnsAndDoesNotBlockStops() {
  const { syncer, attachments, routeUpdates, stopUpdates } = createHarness();
  attachments.delete(9);

  const result = await syncer.sync(
    syncInput({ candidate: candidateFixture({ media: { featuredAttachmentId: 9 } }) }),
  );

  assert.equal(coverUpdate(routeUpdates).coverImageUrl, null);
  assert.equal((stopUpdates[0] as { data: { photoUrl: string | null } }).data.photoUrl, "/uploads/10.webp");
  assert.ok(result.warnings.some((w) => w.code === "ROUTE_COVER_ATTACHMENT_MISSING"));
}

async function testUniqueAttachmentIdsIncludesCoverOnce() {
  assert.deepEqual(uniqueAttachmentIds(candidateFixture({ media: { featuredAttachmentId: 10 } })), [10, 11, 12]);
  assert.deepEqual(uniqueAttachmentIds(candidateFixture({ media: { featuredAttachmentId: 9 } })), [9, 10, 11, 12]);
}

async function main() {
  await testNoStopMediaClearsCoverAndDoesNotImport();
  await testCoverImportedFromThumbnailId();
  await testMissingCoverLeavesCoverImageUrlNull();
  await testSingleAttachmentLinkedToCorrectStopOrder();
  await testMultipleImagesStoredInSourceOrderIncludingFirst();
  await testDuplicateSourceAttachmentStoredOnce();
  await testMissingAttachmentWarnsAndUsesNextValidForSameStop();
  await testInvalidAttachmentUrlWarnsAndSkips();
  await testRepeatedSyncReusesLineageAndDoesNotDuplicateGallery();
  await testCoverAndStopSharingAttachmentDoNotDuplicateLineage();
  await testMissingOwnerSkipsMediaWithWarning();
  await testFailedDownloadDoesNotBlockOtherStopMedia();
  await testMissingCoverAttachmentWarnsAndDoesNotBlockStops();
  await testUniqueAttachmentIdsIncludesCoverOnce();
}

main()
  .then(() => {
    console.log("RouteStopMediaSyncer tests: OK");
  })
  .catch((error) => {
    console.error("RouteStopMediaSyncer tests: FAILED", error);
    process.exitCode = 1;
  });
