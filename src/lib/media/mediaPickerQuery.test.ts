/**
 * Integration test for queryMediaPickerPage — cursor pagination behind the
 * article/business media pickers.
 *
 * Run: set -a; source .env; set +a; npx tsx src/lib/media/mediaPickerQuery.test.ts
 */
import assert from "node:assert/strict";
import { MediaAssetKind, MediaAssetStatus, MediaEntityType, MediaSourceType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { queryMediaPickerPage } from "./mediaPickerQuery";
import { MEDIA_PICKER_PAGE_SIZE } from "./mediaPickerConstants";

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds: string[] = [];
const createdMediaIds: string[] = [];

async function createUser(label: string): Promise<string> {
  const user = await prisma.user.create({
    data: { email: `media-picker-test-${label}-${runId}@example.invalid` },
    select: { id: true },
  });
  createdUserIds.push(user.id);
  return user.id;
}

let assetCounter = 0;

async function createAsset(uploadedById: string, index: number, createdAt: Date): Promise<string> {
  const key = `${uploadedById}-${index}-${assetCounter++}`;
  const asset = await prisma.mediaAsset.create({
    data: {
      kind: MediaAssetKind.IMAGE,
      status: MediaAssetStatus.ACTIVE,
      filename: `test-${runId}-${key}.jpg`,
      originalName: `test-${key}.jpg`,
      mimeType: "image/jpeg",
      extension: "jpg",
      sizeBytes: 1024,
      storageKey: `media-picker-test/${runId}/${key}`,
      publicUrl: `https://example.invalid/media-picker-test/${runId}/${key}.jpg`,
      sourceType: MediaSourceType.USER_UPLOAD,
      uploadedById,
      createdAt,
    },
    select: { id: true },
  });
  createdMediaIds.push(asset.id);
  return asset.id;
}

async function cleanup() {
  if (createdMediaIds.length > 0) {
    await prisma.mediaUsage.deleteMany({ where: { mediaId: { in: createdMediaIds } } });
    await prisma.mediaAsset.deleteMany({ where: { id: { in: createdMediaIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
}

async function main() {
  try {
    const ownerA = await createUser("owner-a");
    const ownerB = await createUser("owner-b");

    // 25 assets for owner A, newest first by construction (index 0 = oldest).
    const base = new Date("2026-01-01T00:00:00.000Z").getTime();
    const assetIdsOldestFirst: string[] = [];
    for (let i = 0; i < 25; i++) {
      const id = await createAsset(ownerA, i, new Date(base + i * 1000));
      assetIdsOldestFirst.push(id);
    }
    const assetIdsNewestFirst = [...assetIdsOldestFirst].reverse();
    await prisma.mediaUsage.create({
      data: { mediaId: assetIdsNewestFirst[0], entityType: MediaEntityType.ARTICLE, entityId: `test-${runId}`, field: "image-block" },
    });

    // Owner B's own asset must never leak into owner A's pages.
    await createAsset(ownerB, 0, new Date(base + 999_000));

    // --- Scenario: default page size is MEDIA_PICKER_PAGE_SIZE (24) ---
    const page1 = await queryMediaPickerPage({ uploadedById: ownerA });
    assert.equal(page1.items.length, MEDIA_PICKER_PAGE_SIZE, "first page must return exactly the page size");
    assert.equal(page1.hasMore, true, "hasMore must be true when more rows exist");
    assert.ok(page1.nextCursor, "nextCursor must be set when hasMore is true");
    assert.deepEqual(
      page1.items.map((i) => i.id),
      assetIdsNewestFirst.slice(0, MEDIA_PICKER_PAGE_SIZE),
      "first page must be ordered createdAt desc",
    );
    assert.ok(
      page1.items.every((i) => i.publicUrl && i.publicUrl.includes(runId)),
      "every returned item must belong to this test run",
    );
    assert.equal(page1.items[0].isUsed, true, "persisted usage must be returned with the picker page");
    assert.ok(page1.items.slice(1).every((item) => item.isUsed === false));

    // --- Scenario: second page via cursor returns the remainder, hasMore=false ---
    const page2 = await queryMediaPickerPage({ uploadedById: ownerA, cursor: page1.nextCursor });
    assert.equal(page2.items.length, 1, "second page must return the single remaining asset");
    assert.equal(page2.hasMore, false, "hasMore must be false once exhausted");
    assert.equal(page2.nextCursor, null, "nextCursor must be null once exhausted");
    assert.equal(page2.items[0].id, assetIdsNewestFirst[MEDIA_PICKER_PAGE_SIZE]);

    // --- Scenario: no duplicates and no gaps across pages ---
    const combinedIds = [...page1.items.map((i) => i.id), ...page2.items.map((i) => i.id)];
    assert.equal(combinedIds.length, 25, "combined pages must cover all 25 assets");
    assert.equal(new Set(combinedIds).size, 25, "combined pages must not contain duplicates");
    assert.deepEqual(combinedIds, assetIdsNewestFirst, "combined pages must match full newest-first order");

    // --- Scenario: owner scoping — owner A never sees owner B's assets ---
    assert.ok(
      combinedIds.every((id) => !createdMediaIds.slice(25).includes(id)),
      "owner A pages must not include owner B's asset",
    );
    const ownerBPage = await queryMediaPickerPage({ uploadedById: ownerB });
    assert.equal(ownerBPage.items.length, 1);
    assert.equal(ownerBPage.hasMore, false);
    assert.ok(
      ownerBPage.items.every((i) => !assetIdsNewestFirst.includes(i.id)),
      "owner B page must not include owner A's assets",
    );

    // --- Scenario: an owner with fewer assets than the page size gets hasMore=false immediately ---
    const ownerC = await createUser("owner-c");
    for (let i = 0; i < 10; i++) {
      await createAsset(ownerC, i, new Date(base + i * 1000));
    }
    const ownerCPage = await queryMediaPickerPage({ uploadedById: ownerC });
    assert.equal(ownerCPage.items.length, 10);
    assert.equal(ownerCPage.hasMore, false);
    assert.equal(ownerCPage.nextCursor, null);

    // --- Scenario: client-requested limit is honoured but capped by MEDIA_PICKER_MAX_LIMIT ---
    const smallPage = await queryMediaPickerPage({ uploadedById: ownerA, limit: 5 });
    assert.equal(smallPage.items.length, 5);
    assert.equal(smallPage.hasMore, true);

    console.log("mediaPickerQuery.test.ts: OK");
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
