import assert from "node:assert/strict";

import { RouteStopMediaSyncer, type RouteStopMediaSyncerPrismaClient } from "./RouteStopMediaSyncer";
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
  const importCalls: unknown[] = [];
  const lineageCalls: unknown[] = [];

  for (const id of options.existingMediaIds ?? []) {
    const mediaId = `media-${id}`;
    assets.set(mediaId, { id: mediaId, publicUrl: `/uploads/${id}.webp`, deletedAt: null });
    lineages.set(`wordpress-db:attachment:${id}`, mediaId);
  }

  const prisma: RouteStopMediaSyncerPrismaClient = {
    routeStop: {
      updateMany: (async (args: unknown) => {
        stopUpdates.push(args);
        return { count: 1 };
      }) as unknown as RouteStopMediaSyncerPrismaClient["routeStop"]["updateMany"],
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
        return {
          lineageId: `lineage-${lineageCalls.length}`,
          sourceRecordKey: input.sourceRecordKey,
          targetType: input.targetType,
          targetId: input.targetId,
        };
      },
    },
  });

  return { syncer, stopUpdates, importCalls, lineageCalls, attachments };
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

async function testNoStopMediaDoesNothing() {
  const { syncer, stopUpdates, importCalls } = createHarness();

  const result = await syncer.sync(
    syncInput({ candidate: candidateFixture({ stops: [{ index: 1, title: "First", description: null, imageAttachmentIds: [], placeId: null }] }) }),
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(stopUpdates, []);
  assert.deepEqual(importCalls, []);
}

async function testSingleAttachmentLinkedToCorrectStopOrder() {
  const { syncer, stopUpdates, lineageCalls } = createHarness();

  const result = await syncer.sync(syncInput());

  assert.equal(lineageCalls.length, 2);
  assert.equal((stopUpdates[0] as { where: { routeId: string; order: number }; data: { photoUrl: string | null } }).where.order, 1);
  assert.equal((stopUpdates[0] as { data: { photoUrl: string | null } }).data.photoUrl, "/uploads/10.webp");
  assert.equal((stopUpdates[1] as { where: { routeId: string; order: number }; data: { photoUrl: string | null } }).where.order, 2);
  assert.equal((stopUpdates[1] as { data: { photoUrl: string | null } }).data.photoUrl, "/uploads/11.webp");
  assert.ok(result.warnings.some((w) => w.code === "ROUTE_STOP_MEDIA_IMPORTED"));
}

async function testMultipleAttachmentsUseFirstImportedAndWarnAboutExtras() {
  const { syncer, stopUpdates } = createHarness();

  const result = await syncer.sync(syncInput());

  assert.equal((stopUpdates[1] as { data: { photoUrl: string | null } }).data.photoUrl, "/uploads/11.webp");
  const extraWarning = result.warnings.find((w) => w.code === "ROUTE_STOP_MEDIA_EXTRA_ATTACHMENTS_SKIPPED");
  assert.ok(extraWarning);
  assert.deepEqual(extraWarning.details?.skippedAttachmentIds, [12]);
}

async function testMissingAttachmentWarnsAndUsesNextValidForSameStop() {
  const { syncer, attachments, stopUpdates } = createHarness();
  attachments.delete(11);

  const result = await syncer.sync(syncInput());

  assert.equal((stopUpdates[1] as { data: { photoUrl: string | null } }).data.photoUrl, "/uploads/12.webp");
  assert.ok(result.warnings.some((w) => w.code === "ROUTE_STOP_MEDIA_ATTACHMENT_MISSING"));
}

async function testInvalidAttachmentUrlWarnsAndSkips() {
  const { syncer, attachments, stopUpdates } = createHarness();
  attachments.set(10, attachment(10, { guid: "not-a-url" }));

  const result = await syncer.sync(syncInput());

  assert.equal((stopUpdates[0] as { data: { photoUrl: string | null } }).data.photoUrl, null);
  assert.ok(result.warnings.some((w) => w.code === "ROUTE_STOP_MEDIA_URL_INVALID"));
}

async function testRepeatedSyncReusesLineageAndDoesNotReimport() {
  const { syncer, importCalls, lineageCalls } = createHarness();

  await syncer.sync(syncInput());
  const second = await syncer.sync(syncInput());

  assert.equal(lineageCalls.length, 2);
  assert.equal(importCalls.length, 2, "second run must reuse existing MEDIA_ASSET lineage");
  assert.ok(second.warnings.some((w) => w.code === "ROUTE_STOP_MEDIA_DEDUP_REUSED"));
}

async function testMissingOwnerSkipsMediaWithWarning() {
  const { syncer, stopUpdates, importCalls } = createHarness();

  const result = await syncer.sync(syncInput({ mediaOwnerUserId: null }));

  assert.deepEqual(stopUpdates, []);
  assert.deepEqual(importCalls, []);
  assert.ok(result.warnings.some((w) => w.code === "ROUTE_STOP_MEDIA_OWNER_MISSING"));
}

async function testFailedDownloadDoesNotBlockOtherStopMedia() {
  const { syncer, stopUpdates } = createHarness({ failImportIds: [10] });

  const result = await syncer.sync(syncInput());

  assert.equal((stopUpdates[0] as { data: { photoUrl: string | null } }).data.photoUrl, null);
  assert.equal((stopUpdates[1] as { data: { photoUrl: string | null } }).data.photoUrl, "/uploads/11.webp");
  assert.ok(result.warnings.some((w) => w.code === "ROUTE_STOP_MEDIA_DOWNLOAD_FAILED"));
}

async function main() {
  await testNoStopMediaDoesNothing();
  await testSingleAttachmentLinkedToCorrectStopOrder();
  await testMultipleAttachmentsUseFirstImportedAndWarnAboutExtras();
  await testMissingAttachmentWarnsAndUsesNextValidForSameStop();
  await testInvalidAttachmentUrlWarnsAndSkips();
  await testRepeatedSyncReusesLineageAndDoesNotReimport();
  await testMissingOwnerSkipsMediaWithWarning();
  await testFailedDownloadDoesNotBlockOtherStopMedia();
}

main()
  .then(() => {
    console.log("RouteStopMediaSyncer tests: OK");
  })
  .catch((error) => {
    console.error("RouteStopMediaSyncer tests: FAILED", error);
    process.exitCode = 1;
  });
