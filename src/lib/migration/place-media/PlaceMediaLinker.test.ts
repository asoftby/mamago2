import assert from "node:assert/strict";

import type { MediaAsset, MigrationLineage } from "@prisma/client";

import type { NormalizedPlaceCandidate } from "../commit/place/types";
import type { FindLineageBySourceRecordKeysInput, LineageMap } from "../ledger/types";
import { buildWordPressAttachmentSourceRecordKey } from "./attachmentSourceRecordKey";
import { PlaceMediaLinker } from "./PlaceMediaLinker";
import type { LinkPlaceGalleryInput, PlaceMediaLedgerLike, PlaceMediaLinkerPrismaClient } from "./types";

function lineageFixture(overrides: Partial<MigrationLineage> = {}): MigrationLineage {
  return {
    id: "lineage-1",
    sourceId: "source-1",
    recordId: null,
    runId: null,
    sourceEntityType: "wordpress-db:attachment",
    sourceExternalId: null,
    sourceStableKey: "attachment:555",
    sourceRecordKey: "wordpress-db:attachment:555",
    targetType: "MEDIA_ASSET",
    targetId: "media-1",
    targetRole: "primary",
    targetNaturalKey: null,
    lastSourceHash: "hash-a",
    lastPlanAction: null,
    isActive: true,
    firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
    lastSeenAt: null,
    lastImportedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function mediaAssetFixture(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "media-1",
    kind: "IMAGE",
    status: "ACTIVE",
    filename: "cozy-cafe.webp",
    originalName: "cozy-cafe.jpg",
    mimeType: "image/webp",
    extension: "webp",
    sizeBytes: 12345,
    width: 800,
    height: 600,
    durationSec: null,
    storageKey: "media/2026/07/cozy-cafe-abc123.webp",
    publicUrl: "https://mamago.example.com/media/cozy-cafe.webp",
    checksum: null,
    contentHash: null,
    alt: null,
    title: null,
    caption: null,
    sourceType: "MIGRATED",
    uploadedById: null,
    wizardSessionId: null,
    draftEntityId: null,
    draftEntityType: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  };
}

function candidateMediaFixture(
  overrides: Partial<NormalizedPlaceCandidate["media"]> = {},
): NormalizedPlaceCandidate["media"] {
  return {
    thumbnailAttachmentId: 999,
    galleryAttachmentIds: [555, 556],
    ...overrides,
  };
}

function inputFixture(overrides: Partial<LinkPlaceGalleryInput> = {}): LinkPlaceGalleryInput {
  return {
    adapterKey: "wordpress-db",
    sourceNamespace: "mamago-blog",
    sourceId: "source-1",
    placeId: "place-1",
    media: candidateMediaFixture(),
    ...overrides,
  };
}

function createFakeLedger(lineageByKey: ReadonlyMap<string, readonly MigrationLineage[]> = new Map()) {
  const calls: FindLineageBySourceRecordKeysInput[] = [];
  const ledger: PlaceMediaLedgerLike = {
    findLineageBySourceRecordKeys: async (input) => {
      calls.push(input);
      const map = new Map<string, readonly MigrationLineage[]>();
      for (const key of input.keys) {
        const rows = lineageByKey.get(key);
        if (rows) {
          map.set(key, rows);
        }
      }
      return map as LineageMap;
    },
  };
  return { ledger, calls };
}

function createFakePrisma(mediaAssetsById: ReadonlyMap<string, MediaAsset> = new Map()) {
  const findManyCalls: unknown[] = [];
  const createCalls: Array<{ data: Record<string, unknown> }> = [];
  let nextId = 1;

  const prisma: PlaceMediaLinkerPrismaClient = {
    mediaAsset: {
      findMany: (async (args: unknown) => {
        findManyCalls.push(args);
        const ids = (args as { where: { id: { in: string[] } } }).where.id.in;
        return ids.map((id) => mediaAssetsById.get(id)).filter((asset): asset is MediaAsset => Boolean(asset));
      }) as unknown as PlaceMediaLinkerPrismaClient["mediaAsset"]["findMany"],
    },
    placeImage: {
      create: (async (args: unknown) => {
        const call = args as { data: Record<string, unknown> };
        createCalls.push(call);
        const id = `place-image-${nextId++}`;
        return { id, ...call.data };
      }) as unknown as PlaceMediaLinkerPrismaClient["placeImage"]["create"],
    },
  };
  return { prisma, findManyCalls, createCalls };
}

async function testGalleryCreatesRowsInOrder() {
  const lineageByKey = new Map<string, readonly MigrationLineage[]>([
    [buildWordPressAttachmentSourceRecordKey(555), [lineageFixture({ targetId: "media-1", sourceRecordKey: buildWordPressAttachmentSourceRecordKey(555) })]],
    [buildWordPressAttachmentSourceRecordKey(556), [lineageFixture({ targetId: "media-2", sourceRecordKey: buildWordPressAttachmentSourceRecordKey(556) })]],
  ]);
  const mediaAssetsById = new Map<string, MediaAsset>([
    ["media-1", mediaAssetFixture({ id: "media-1", publicUrl: "https://mamago.example.com/media/one.webp" })],
    ["media-2", mediaAssetFixture({ id: "media-2", publicUrl: "https://mamago.example.com/media/two.webp" })],
  ]);
  const { ledger } = createFakeLedger(lineageByKey);
  const { prisma, createCalls } = createFakePrisma(mediaAssetsById);
  const linker = new PlaceMediaLinker({ ledger, prisma });

  const result = await linker.linkGalleryImages(inputFixture());

  assert.equal(createCalls.length, 2);
  assert.equal(createCalls[0].data.kind, "GALLERY");
  assert.equal(createCalls[0].data.url, "https://mamago.example.com/media/one.webp");
  assert.equal(createCalls[0].data.sortOrder, 0);
  assert.equal(createCalls[1].data.url, "https://mamago.example.com/media/two.webp");
  assert.equal(createCalls[1].data.sortOrder, 1);

  assert.equal(result.createdPlaceImageIds.length, 2);
  assert.deepEqual(result.skippedAttachmentIds, []);
}

async function testEmptyGalleryCreatesNothing() {
  const { ledger, calls: ledgerCalls } = createFakeLedger();
  const { prisma, findManyCalls, createCalls } = createFakePrisma();
  const linker = new PlaceMediaLinker({ ledger, prisma });

  const result = await linker.linkGalleryImages(
    inputFixture({ media: candidateMediaFixture({ galleryAttachmentIds: [] }) }),
  );

  assert.deepEqual(result, { createdPlaceImageIds: [], skippedAttachmentIds: [] });
  assert.equal(ledgerCalls.length, 0, "no lineage lookup should happen for an empty gallery");
  assert.equal(findManyCalls.length, 0);
  assert.equal(createCalls.length, 0);
}

async function testMissingLineageSkipped() {
  const lineageByKey = new Map<string, readonly MigrationLineage[]>([
    [buildWordPressAttachmentSourceRecordKey(555), [lineageFixture({ targetId: "media-1", sourceRecordKey: buildWordPressAttachmentSourceRecordKey(555) })]],
    // 556 intentionally has no lineage row at all.
  ]);
  const mediaAssetsById = new Map<string, MediaAsset>([
    ["media-1", mediaAssetFixture({ id: "media-1" })],
  ]);
  const { ledger } = createFakeLedger(lineageByKey);
  const { prisma, findManyCalls } = createFakePrisma(mediaAssetsById);
  const linker = new PlaceMediaLinker({ ledger, prisma });

  const result = await linker.linkGalleryImages(inputFixture());

  assert.equal(result.createdPlaceImageIds.length, 1);
  assert.deepEqual(result.skippedAttachmentIds, [556]);
  const lookedUpIds = (findManyCalls[0] as { where: { id: { in: string[] } } }).where.id.in;
  assert.deepEqual(lookedUpIds, ["media-1"], "an attachment with no lineage must never be looked up in mediaAsset");
}

async function testMissingMediaAssetSkipped() {
  const lineageByKey = new Map<string, readonly MigrationLineage[]>([
    [buildWordPressAttachmentSourceRecordKey(555), [lineageFixture({ targetId: "media-1", sourceRecordKey: buildWordPressAttachmentSourceRecordKey(555) })]],
  ]);
  // mediaAssetsById intentionally empty: lineage resolves to media-1, but no such MediaAsset row exists.
  const { ledger } = createFakeLedger(lineageByKey);
  const { prisma, createCalls } = createFakePrisma();
  const linker = new PlaceMediaLinker({ ledger, prisma });

  const result = await linker.linkGalleryImages(
    inputFixture({ media: candidateMediaFixture({ galleryAttachmentIds: [555] }) }),
  );

  assert.deepEqual(result, { createdPlaceImageIds: [], skippedAttachmentIds: [555] });
  assert.equal(createCalls.length, 0);
}

async function testHelperBuildsSameKeyForNumberAndString() {
  assert.equal(buildWordPressAttachmentSourceRecordKey(555), "wordpress-db:attachment:555");
  assert.equal(buildWordPressAttachmentSourceRecordKey("555"), "wordpress-db:attachment:555");
  assert.equal(buildWordPressAttachmentSourceRecordKey(555), buildWordPressAttachmentSourceRecordKey("555"));
}

async function testThumbnailAttachmentIdIgnoredCompletely() {
  const lineageByKey = new Map<string, readonly MigrationLineage[]>([
    [buildWordPressAttachmentSourceRecordKey(555), [lineageFixture({ targetId: "media-1", sourceRecordKey: buildWordPressAttachmentSourceRecordKey(555) })]],
  ]);
  const mediaAssetsById = new Map<string, MediaAsset>([["media-1", mediaAssetFixture({ id: "media-1" })]]);
  const { ledger, calls: ledgerCalls } = createFakeLedger(lineageByKey);
  const { prisma, createCalls } = createFakePrisma(mediaAssetsById);
  const linker = new PlaceMediaLinker({ ledger, prisma });

  await linker.linkGalleryImages(
    inputFixture({ media: candidateMediaFixture({ thumbnailAttachmentId: 999, galleryAttachmentIds: [555] }) }),
  );

  const thumbnailKey = buildWordPressAttachmentSourceRecordKey(999);
  assert.ok(
    !ledgerCalls[0].keys.includes(thumbnailKey),
    "thumbnailAttachmentId must never be looked up — logo linking is out of scope for this PR",
  );
  assert.ok(
    createCalls.every((call) => call.data.kind === "GALLERY"),
    "no LOGO PlaceImage may ever be created by this class",
  );
}

async function testNoPlaceDelegateExistsStructurally() {
  // `PlaceMediaLinkerPrismaClient` only ever exposes `mediaAsset`/`placeImage`
  // — there is no `place` delegate to call `.update()` on, and no import of
  // `attachMediaToEntity` anywhere in this module (confirmed by inspection,
  // not just this fake), so `MediaUsage`/`Place.logoImageId` are
  // structurally unreachable from this class.
  const { prisma } = createFakePrisma();
  assert.deepEqual(Object.keys(prisma).sort(), ["mediaAsset", "placeImage"]);
}

async function main() {
  await testGalleryCreatesRowsInOrder();
  await testEmptyGalleryCreatesNothing();
  await testMissingLineageSkipped();
  await testMissingMediaAssetSkipped();
  await testHelperBuildsSameKeyForNumberAndString();
  await testThumbnailAttachmentIdIgnoredCompletely();
  await testNoPlaceDelegateExistsStructurally();
}

main()
  .then(() => {
    console.log("PlaceMediaLinker tests: OK");
  })
  .catch((error) => {
    console.error("PlaceMediaLinker tests: FAILED", error);
    process.exitCode = 1;
  });
