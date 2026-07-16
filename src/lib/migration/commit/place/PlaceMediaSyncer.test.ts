import assert from "node:assert/strict";

import { PlaceMediaSyncer, type PlaceMediaSyncerPrismaClient } from "./PlaceMediaSyncer";
import type { NormalizedPlaceCandidate } from "./types";
import type { WordPressAttachmentRow } from "../../adapters/wordpress-db/types";
import type { MediaImporterLike } from "../../media/types";

type PlaceImageRow = {
  id: string;
  placeId: string;
  kind: string;
  url: string;
  width: number | null;
  height: number | null;
  sortOrder: number;
};

function attachment(id: number, overrides: Partial<WordPressAttachmentRow> = {}): WordPressAttachmentRow {
  return {
    ID: id,
    post_title: `Attachment ${id}`,
    post_name: `attachment-${id}`,
    post_mime_type: "image/jpeg",
    guid: `https://wp.example.com/${id}.jpg`,
    post_parent: 301,
    attached_file: null,
    ...overrides,
  };
}

function candidateFixture(overrides: Partial<NormalizedPlaceCandidate> = {}): NormalizedPlaceCandidate {
  return {
    title: "Cool Place",
    slug: "cool-place",
    content: "<p>A cool place for kids.</p>",
    excerpt: "A cool place excerpt",
    status: "publish",
    publishedAt: "2026-01-01 00:00:00",
    modifiedAt: "2026-01-02 00:00:00",
    shortDescription: "A great place for kids",
    phone: "+375291234567",
    phoneE164: "+375291234567",
    openingHours: null,
    email: "hello@example.com",
    workHoursRaw: "Mon-Fri 9-18",
    locationRaw: "Minsk, some street",
    cityRaw: "Minsk",
    coordinates: { lat: 53.9, lng: 27.5667 },
    media: { thumbnailAttachmentId: 10, galleryAttachmentIds: [11, 12] },
    seo: { title: "SEO Title", focusKeyword: "kids playground" },
    sourceTerms: [],
    rawMeta: {},
    ...overrides,
  };
}

function createHarness(
  options: {
    failImportIds?: readonly number[];
    /** Fail these ids only on their first import attempt; succeed after that — for retry tests. */
    failImportIdsOnce?: readonly number[];
    failImportMessage?: (id: number) => string;
    existingMediaIds?: readonly number[];
    existingPlaceImages?: readonly PlaceImageRow[];
    attachmentOverrides?: Map<number, WordPressAttachmentRow>;
  } = {},
) {
  const failedOnceAlready = new Set<number>();
  const assets = new Map<string, { id: string; publicUrl: string; width: number | null; height: number | null; deletedAt: null }>();
  const lineages = new Map<string, string>();
  const placeImages: PlaceImageRow[] = [...(options.existingPlaceImages ?? [])];
  let nextRowId = placeImages.length + 1;

  for (const id of options.existingMediaIds ?? []) {
    const mediaId = `media-${id}`;
    assets.set(mediaId, { id: mediaId, publicUrl: `/uploads/${id}.webp`, width: 800, height: 600, deletedAt: null });
    lineages.set(`wordpress-db:attachment:${id}`, mediaId);
  }

  const prisma: PlaceMediaSyncerPrismaClient = {
    placeImage: {
      findMany: (async (args: { where: { placeId: string } }) => {
        return placeImages
          .filter((row) => row.placeId === args.where.placeId)
          .map((r) => ({ id: r.id, url: r.url, sortOrder: r.sortOrder }));
      }) as unknown as PlaceMediaSyncerPrismaClient["placeImage"]["findMany"],
      create: (async (args: { data: Omit<PlaceImageRow, "id"> }) => {
        const row: PlaceImageRow = { id: `image-${nextRowId++}`, ...args.data };
        placeImages.push(row);
        return row;
      }) as unknown as PlaceMediaSyncerPrismaClient["placeImage"]["create"],
      update: (async (args: { where: { id: string }; data: { sortOrder: number } }) => {
        const row = placeImages.find((r) => r.id === args.where.id);
        if (!row) throw new Error(`placeImage ${args.where.id} not found`);
        row.sortOrder = args.data.sortOrder;
        return row;
      }) as unknown as PlaceMediaSyncerPrismaClient["placeImage"]["update"],
    },
    mediaAsset: {
      findFirst: (async (args: { where: { id?: string } }) => {
        const id = args.where.id;
        return id ? assets.get(id) ?? null : null;
      }) as unknown as PlaceMediaSyncerPrismaClient["mediaAsset"]["findFirst"],
    },
    migrationLineage: {
      findFirst: (async (args: { where: { sourceRecordKey: string } }) => {
        const mediaId = lineages.get(args.where.sourceRecordKey);
        return mediaId ? { targetId: mediaId } : null;
      }) as unknown as PlaceMediaSyncerPrismaClient["migrationLineage"]["findFirst"],
    },
  };

  const attachments = new Map<number, WordPressAttachmentRow>([
    [10, attachment(10)],
    [11, attachment(11)],
    [12, attachment(12)],
    ...(options.attachmentOverrides ?? new Map()),
  ]);

  const importCalls: string[] = [];
  const importer: MediaImporterLike = {
    importFromUrl: async (input) => {
      const id = Number(input.sourceRecordKey.split(":").pop());
      importCalls.push(input.sourceRecordKey);
      if (options.failImportIds?.includes(id)) {
        throw new Error(options.failImportMessage?.(id) ?? `download failed for ${id}`);
      }
      if (options.failImportIdsOnce?.includes(id) && !failedOnceAlready.has(id)) {
        failedOnceAlready.add(id);
        throw new Error(options.failImportMessage?.(id) ?? `download failed for ${id}`);
      }
      const mediaId = `media-${id}`;
      const publicUrl = `/uploads/${id}.webp`;
      assets.set(mediaId, { id: mediaId, publicUrl, width: 800, height: 600, deletedAt: null });
      return { mediaId, storageKey: publicUrl, publicUrl, width: 800, height: 600 };
    },
  };

  const lineageCalls: unknown[] = [];
  const syncer = new PlaceMediaSyncer({
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
        return { lineageId: `lineage-${lineageCalls.length}`, sourceRecordKey: input.sourceRecordKey, targetType: input.targetType, targetId: input.targetId };
      },
    },
  });

  return { syncer, placeImages, lineageCalls, importCalls, attachments };
}

function syncInput(overrides: Partial<Parameters<PlaceMediaSyncer["sync"]>[0]> = {}) {
  return {
    placeId: "place-1",
    candidate: candidateFixture(),
    uploadedByUserId: "user-1",
    sourceId: "source-1",
    sourceHash: "place-hash",
    runId: "run-1",
    recordId: "record-1",
    sourceRecordKey: "wordpress-db:places:301",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Basic shapes: cover only / gallery only / cover+gallery / order / dedup.
// ---------------------------------------------------------------------------

async function testCoverOnly() {
  const { syncer, placeImages } = createHarness();
  const result = await syncer.sync(
    syncInput({ candidate: candidateFixture({ media: { thumbnailAttachmentId: 10, galleryAttachmentIds: [] } }) }),
  );

  assert.equal(result.imported, 1);
  assert.deepEqual(
    placeImages.map((r) => ({ url: r.url, sortOrder: r.sortOrder, kind: r.kind })),
    [{ url: "/uploads/10.webp", sortOrder: 0, kind: "GALLERY" }],
  );
}

async function testGalleryOnly() {
  const { syncer, placeImages } = createHarness();
  const result = await syncer.sync(
    syncInput({ candidate: candidateFixture({ media: { thumbnailAttachmentId: null, galleryAttachmentIds: [11, 12] } }) }),
  );

  assert.equal(result.imported, 2);
  assert.deepEqual(
    placeImages.map((r) => r.url),
    ["/uploads/11.webp", "/uploads/12.webp"],
  );
}

async function testCoverAndGalleryCoverIsSortOrderZero() {
  const { syncer, placeImages } = createHarness();
  const result = await syncer.sync(syncInput());

  assert.equal(result.imported, 3);
  assert.deepEqual(
    placeImages.map((r) => ({ url: r.url, sortOrder: r.sortOrder })),
    [
      { url: "/uploads/10.webp", sortOrder: 0 },
      { url: "/uploads/11.webp", sortOrder: 1 },
      { url: "/uploads/12.webp", sortOrder: 2 },
    ],
  );
}

async function testCoverAlsoInGalleryIsNotDuplicated() {
  // Real shape confirmed on 11/82 Places (e.g. Place 43023): cover id
  // reappears inside galleryAttachmentIds. Must produce exactly one
  // PlaceImage for that id, at sortOrder 0 (cover position).
  const { syncer, placeImages, importCalls } = createHarness();
  const result = await syncer.sync(
    syncInput({ candidate: candidateFixture({ media: { thumbnailAttachmentId: 10, galleryAttachmentIds: [10, 11] } }) }),
  );

  assert.equal(result.imported, 2, "the shared id must be imported once, not twice");
  assert.equal(importCalls.filter((k) => k.endsWith(":10")).length, 1);
  assert.deepEqual(
    placeImages.map((r) => ({ url: r.url, sortOrder: r.sortOrder })),
    [
      { url: "/uploads/10.webp", sortOrder: 0 },
      { url: "/uploads/11.webp", sortOrder: 1 },
    ],
  );
}

async function testDuplicateIdsWithinGalleryDoNotDuplicateLinks() {
  const { syncer, placeImages } = createHarness();
  const result = await syncer.sync(
    syncInput({ candidate: candidateFixture({ media: { thumbnailAttachmentId: null, galleryAttachmentIds: [11, 11, 12] } }) }),
  );

  assert.equal(result.imported, 2);
  assert.deepEqual(
    placeImages.map((r) => r.url),
    ["/uploads/11.webp", "/uploads/12.webp"],
  );
}

async function testStableGalleryOrderPreserved() {
  const { syncer, placeImages } = createHarness();
  await syncer.sync(
    syncInput({ candidate: candidateFixture({ media: { thumbnailAttachmentId: null, galleryAttachmentIds: [12, 11] } }) }),
  );

  assert.deepEqual(
    placeImages.map((r) => r.url),
    ["/uploads/12.webp", "/uploads/11.webp"],
    "gallery order must be preserved exactly as given, not sorted",
  );
}

async function testNoMediaIsANoOp() {
  const { syncer, placeImages, importCalls } = createHarness();
  const result = await syncer.sync(
    syncInput({ candidate: candidateFixture({ media: { thumbnailAttachmentId: null, galleryAttachmentIds: [] } }) }),
  );

  assert.deepEqual(result, { warnings: [], imported: 0, reused: 0, skipped: 0, failed: 0 });
  assert.equal(placeImages.length, 0);
  assert.equal(importCalls.length, 0);
}

// ---------------------------------------------------------------------------
// Idempotency: lineage-level reuse, link-level reuse, cross-place reuse.
// ---------------------------------------------------------------------------

async function testExistingLineageReusedWithoutDownload() {
  const { syncer, placeImages, importCalls, lineageCalls } = createHarness({ existingMediaIds: [10] });
  const result = await syncer.sync(
    syncInput({ candidate: candidateFixture({ media: { thumbnailAttachmentId: 10, galleryAttachmentIds: [] } }) }),
  );

  assert.equal(result.reused, 1);
  assert.equal(result.imported, 0);
  assert.equal(importCalls.length, 0, "an existing MEDIA_ASSET lineage must never trigger a download");
  assert.equal(lineageCalls.length, 0);
  assert.ok(result.warnings.some((w) => w.code === "PLACE_MEDIA_ASSET_REUSED"));
  assert.deepEqual(placeImages.map((r) => r.url), ["/uploads/10.webp"]);
}

async function testRepeatedRunOnSamePlaceDoesNotDuplicate() {
  const { syncer, placeImages, importCalls } = createHarness();

  const first = await syncer.sync(syncInput());
  const second = await syncer.sync(syncInput());

  assert.equal(first.imported, 3);
  assert.equal(second.imported, 0);
  assert.equal(second.reused, 3);
  assert.equal(importCalls.length, 3, "second run must not re-download anything");
  assert.equal(placeImages.length, 3, "second run must not create duplicate PlaceImage rows");
  assert.ok(second.warnings.some((w) => w.code === "PLACE_MEDIA_LINK_REUSED"));
}

async function testSameAttachmentIdAcrossTwoPlacesReusesOneMediaAsset() {
  // Real shape confirmed 2026-07-15: attachment 32649 is `cover` for one
  // Place and `gallery` for another. The underlying MediaAsset must be
  // downloaded once and reused for the second Place's own PlaceImage link.
  const { syncer, placeImages, importCalls } = createHarness();

  const first = await syncer.sync(
    syncInput({
      placeId: "place-A",
      candidate: candidateFixture({ media: { thumbnailAttachmentId: 10, galleryAttachmentIds: [] } }),
      sourceRecordKey: "wordpress-db:places:A",
    }),
  );
  const second = await syncer.sync(
    syncInput({
      placeId: "place-B",
      candidate: candidateFixture({ media: { thumbnailAttachmentId: null, galleryAttachmentIds: [10] } }),
      sourceRecordKey: "wordpress-db:places:B",
    }),
  );

  assert.equal(first.imported, 1);
  assert.equal(second.imported, 0);
  assert.equal(second.reused, 1, "the second Place must reuse the MediaAsset via lineage, not re-download");
  assert.equal(importCalls.length, 1);
  assert.deepEqual(
    placeImages.map((r) => ({ placeId: r.placeId, url: r.url })),
    [
      { placeId: "place-A", url: "/uploads/10.webp" },
      { placeId: "place-B", url: "/uploads/10.webp" },
    ],
  );
}

async function testRetryAfterPartialFailureOnlyImportsMissing() {
  const { syncer, placeImages, importCalls } = createHarness({ failImportIdsOnce: [11] });

  const first = await syncer.sync(syncInput());
  assert.equal(first.imported, 2);
  assert.equal(first.failed, 1);
  assert.equal(placeImages.length, 2);

  const second = await syncer.sync(syncInput());
  assert.equal(second.imported, 1, "retry must only import the previously-missing attachment");
  assert.equal(second.reused, 2, "the two already-succeeded attachments must be reused, not re-downloaded");
  assert.equal(placeImages.length, 3);
  assert.equal(
    importCalls.filter((k) => k.endsWith(":11")).length,
    2,
    "one failed attempt on the first run, one successful attempt on the retry",
  );
}

/**
 * Regression test for a review finding (PR #49, chatgpt-codex-connector):
 * when the *cover* (not a gallery item) fails on the first run and later
 * gallery items succeed, a naive "append after max" scheme would place the
 * recovered cover at the back on retry instead of restoring it to
 * sortOrder 0 — breaking the "cover = first GALLERY image" convention the
 * public Place page and admin editor both rely on.
 */
async function testRetryRecoveringEarlierAttachmentRestoresCorrectOrder() {
  // default candidate: cover=10, gallery=[11, 12]
  const { syncer, placeImages } = createHarness({ failImportIdsOnce: [10] });

  const first = await syncer.sync(syncInput());
  assert.equal(first.imported, 2);
  assert.equal(first.failed, 1);
  assert.deepEqual(
    placeImages.map((r) => ({ url: r.url, sortOrder: r.sortOrder })),
    [
      { url: "/uploads/11.webp", sortOrder: 1 },
      { url: "/uploads/12.webp", sortOrder: 2 },
    ],
    "gallery items reserve their true target index even when the cover fails first",
  );

  const second = await syncer.sync(syncInput());
  assert.equal(second.imported, 1, "the retry recovers only the cover");
  assert.equal(second.reused, 2, "the already-correct gallery items are reused, not touched");

  const bySortOrder = [...placeImages].sort((a, b) => a.sortOrder - b.sortOrder);
  assert.deepEqual(
    bySortOrder.map((r) => ({ url: r.url, sortOrder: r.sortOrder })),
    [
      { url: "/uploads/10.webp", sortOrder: 0 },
      { url: "/uploads/11.webp", sortOrder: 1 },
      { url: "/uploads/12.webp", sortOrder: 2 },
    ],
    "the recovered cover must land at sortOrder 0, not appended after the gallery",
  );
}

// ---------------------------------------------------------------------------
// Manual data preservation — never delete, never touch LOGO.
// ---------------------------------------------------------------------------

async function testManuallyAddedImagesAreNeverTouchedByUrl() {
  // A manual image (a URL this call never resolves any attachment to) must
  // never be read, moved, or deleted — matching is by exact URL only.
  const manualRow: PlaceImageRow = {
    id: "manual-1",
    placeId: "place-1",
    kind: "GALLERY",
    url: "/uploads/manual-photo.webp",
    width: 900,
    height: 600,
    sortOrder: 99,
  };
  const { syncer, placeImages } = createHarness({ existingPlaceImages: [manualRow] });

  const result = await syncer.sync(
    syncInput({ candidate: candidateFixture({ media: { thumbnailAttachmentId: 10, galleryAttachmentIds: [] } }) }),
  );

  assert.equal(result.imported, 1);
  assert.equal(placeImages.length, 2, "the manual row must never be deleted");
  const manual = placeImages.find((r) => r.id === "manual-1");
  assert.deepEqual(manual, manualRow, "the manual row must be completely untouched, including its own sortOrder");
  const migrated = placeImages.find((r) => r.id !== "manual-1");
  assert.equal(migrated?.sortOrder, 0, "the migrated cover gets its own correct target index, independent of unrelated rows");
}

// ---------------------------------------------------------------------------
// Missing / unsupported / HEIC / errors — never crash, always a warning.
// ---------------------------------------------------------------------------

async function testMissingUploadedByUserIdSkipsAllMedia() {
  const { syncer, placeImages, importCalls } = createHarness();
  const result = await syncer.sync(syncInput({ uploadedByUserId: null }));

  assert.deepEqual(placeImages, []);
  assert.equal(importCalls.length, 0);
  assert.equal(result.skipped, 3);
  assert.ok(result.warnings.some((w) => w.code === "PLACE_MEDIA_OWNER_MISSING"));
}

async function testMissingAttachmentRowWarnsAndContinues() {
  const { syncer, attachments, placeImages } = createHarness();
  attachments.delete(12);

  const result = await syncer.sync(syncInput());

  assert.equal(result.skipped, 1);
  assert.equal(result.imported, 2);
  assert.ok(result.warnings.some((w) => w.code === "PLACE_MEDIA_SOURCE_MISSING" && w.details?.attachmentId === 12));
  assert.deepEqual(
    placeImages.map((r) => r.url),
    ["/uploads/10.webp", "/uploads/11.webp"],
  );
}

async function testUnsupportedMimeSkipsWithoutDownloadAttempt() {
  const overrides = new Map([[12, attachment(12, { post_mime_type: "application/pdf" })]]);
  const { syncer, importCalls, placeImages } = createHarness({ attachmentOverrides: overrides });

  const result = await syncer.sync(syncInput());

  assert.equal(result.skipped, 1);
  assert.equal(importCalls.some((k) => k.endsWith(":12")), false, "an unsupported format must never reach the importer");
  assert.ok(result.warnings.some((w) => w.code === "PLACE_MEDIA_FORMAT_UNSUPPORTED"));
  assert.deepEqual(
    placeImages.map((r) => r.url),
    ["/uploads/10.webp", "/uploads/11.webp"],
  );
}

async function testHeicIsFailClosedWithoutDownloadAttempt() {
  const overrides = new Map([[12, attachment(12, { post_mime_type: "image/heic" })]]);
  const { syncer, importCalls } = createHarness({ attachmentOverrides: overrides });

  const result = await syncer.sync(syncInput());

  assert.equal(result.skipped, 1);
  assert.equal(importCalls.some((k) => k.endsWith(":12")), false, "HEIC must be skipped fail-closed, never attempted");
  assert.ok(result.warnings.some((w) => w.code === "PLACE_MEDIA_HEIC_UNSUPPORTED"));
}

async function testDownloadFailureWarnsAndKeepsOtherAttachments() {
  const { syncer, placeImages } = createHarness({
    failImportIds: [11],
    failImportMessage: () => "Failed to download media from https://wp.example.com/11.jpg: HTTP 500",
  });

  const result = await syncer.sync(syncInput());

  assert.equal(result.failed, 1);
  assert.equal(result.imported, 2);
  assert.ok(result.warnings.some((w) => w.code === "PLACE_MEDIA_DOWNLOAD_FAILED"));
  assert.deepEqual(
    placeImages.map((r) => r.url),
    ["/uploads/10.webp", "/uploads/12.webp"],
  );
}

async function testProcessorFailureClassifiedSeparatelyFromDownloadFailure() {
  const { syncer } = createHarness({
    failImportIds: [11],
    failImportMessage: () => "sharp: unsupported image format in buffer",
  });

  const result = await syncer.sync(syncInput());

  assert.equal(result.failed, 1);
  assert.ok(result.warnings.some((w) => w.code === "PLACE_MEDIA_PROCESS_FAILED"));
  assert.ok(!result.warnings.some((w) => w.code === "PLACE_MEDIA_DOWNLOAD_FAILED"));
}

async function testPartialGallerySuccessProducesPartialWarning() {
  const { syncer, placeImages } = createHarness({ failImportIds: [11] });

  const result = await syncer.sync(syncInput());

  assert.equal(result.imported, 2);
  assert.equal(result.failed, 1);
  assert.equal(placeImages.length, 2, "the two successful attachments must still be linked");
  const partial = result.warnings.find((w) => w.code === "PLACE_MEDIA_PARTIAL");
  assert.ok(partial, "a partial failure must be summarized in a single PLACE_MEDIA_PARTIAL warning");
  assert.deepEqual(partial?.details, { imported: 2, reused: 0, skipped: 0, failed: 1 });
}

async function main() {
  await testCoverOnly();
  await testGalleryOnly();
  await testCoverAndGalleryCoverIsSortOrderZero();
  await testCoverAlsoInGalleryIsNotDuplicated();
  await testDuplicateIdsWithinGalleryDoNotDuplicateLinks();
  await testStableGalleryOrderPreserved();
  await testNoMediaIsANoOp();

  await testExistingLineageReusedWithoutDownload();
  await testRepeatedRunOnSamePlaceDoesNotDuplicate();
  await testSameAttachmentIdAcrossTwoPlacesReusesOneMediaAsset();
  await testRetryAfterPartialFailureOnlyImportsMissing();

  await testManuallyAddedImagesAreNeverTouchedByUrl();
  await testRetryRecoveringEarlierAttachmentRestoresCorrectOrder();

  await testMissingUploadedByUserIdSkipsAllMedia();
  await testMissingAttachmentRowWarnsAndContinues();
  await testUnsupportedMimeSkipsWithoutDownloadAttempt();
  await testHeicIsFailClosedWithoutDownloadAttempt();
  await testDownloadFailureWarnsAndKeepsOtherAttachments();
  await testProcessorFailureClassifiedSeparatelyFromDownloadFailure();
  await testPartialGallerySuccessProducesPartialWarning();
}

main()
  .then(() => {
    console.log("PlaceMediaSyncer tests: OK");
  })
  .catch((error) => {
    console.error("PlaceMediaSyncer tests: FAILED", error);
    process.exitCode = 1;
  });
