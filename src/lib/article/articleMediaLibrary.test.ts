/**
 * Integration test for getArticleMediaItems — the DB aggregation behind
 * GET /api/admin/articles/[id]/media ("Фото этой статьи").
 *
 * Covers the ticket's central scenario: MIGRATED MediaAsset rows historically
 * owned by ADMIN must still appear here when referenced by the article, even
 * though the article's own authorUserId is someone else entirely — Article
 * Media is not an ownership filter.
 *
 * Run: set -a; source .env; set +a; npx tsx src/lib/article/articleMediaLibrary.test.ts
 */
import assert from "node:assert/strict";
import { ContentStatus, MediaAssetKind, MediaAssetStatus, MediaSourceType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getArticleMediaItems } from "./articleMediaLibrary";
import { emptyArticleContent, serializeArticleContent, type ArticleBlockMvp } from "@/lib/publications/articleMvp";

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds: string[] = [];
const createdMediaIds: string[] = [];
const createdArticleIds: string[] = [];

async function createUser(label: string, role: "USER" | "ADMIN" = "USER"): Promise<string> {
  const user = await prisma.user.create({
    data: { email: `article-media-test-${label}-${runId}@example.invalid`, role },
    select: { id: true },
  });
  createdUserIds.push(user.id);
  return user.id;
}

let assetCounter = 0;

async function createAsset(opts: {
  uploadedById: string;
  sourceType?: MediaSourceType;
  publicUrl?: string | null;
}): Promise<string> {
  const key = `${opts.uploadedById}-${assetCounter++}`;
  const asset = await prisma.mediaAsset.create({
    data: {
      kind: MediaAssetKind.IMAGE,
      status: MediaAssetStatus.ACTIVE,
      filename: `test-${runId}-${key}.jpg`,
      originalName: `test-${key}.jpg`,
      mimeType: "image/jpeg",
      extension: "jpg",
      sizeBytes: 1024,
      storageKey: `article-media-test/${runId}/${key}`,
      publicUrl: opts.publicUrl === undefined ? `https://example.invalid/article-media-test/${runId}/${key}.jpg` : opts.publicUrl,
      sourceType: opts.sourceType ?? MediaSourceType.USER_UPLOAD,
      uploadedById: opts.uploadedById,
    },
    select: { id: true },
  });
  createdMediaIds.push(asset.id);
  return asset.id;
}

async function createArticle(opts: {
  authorUserId: string | null;
  coverImageId?: string | null;
  seoImageId?: string | null;
  blocks?: ArticleBlockMvp[];
}): Promise<string> {
  const content = { ...emptyArticleContent(), blocks: opts.blocks ?? [] };
  const article = await prisma.article.create({
    data: {
      title: `Article media test ${runId}`,
      contentJson: serializeArticleContent(content),
      coverImageId: opts.coverImageId ?? null,
      seoImageId: opts.seoImageId ?? null,
      authorUserId: opts.authorUserId,
      status: ContentStatus.DRAFT,
    },
    select: { id: true },
  });
  createdArticleIds.push(article.id);
  return article.id;
}

async function cleanup() {
  if (createdArticleIds.length > 0) {
    await prisma.article.deleteMany({ where: { id: { in: createdArticleIds } } });
  }
  if (createdMediaIds.length > 0) {
    await prisma.mediaAsset.deleteMany({ where: { id: { in: createdMediaIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
}

async function main() {
  try {
    // --- Scenario: unknown article id → null (not an empty list) ---
    const missing = await getArticleMediaItems(`nonexistent-${runId}`);
    assert.equal(missing, null, "unknown article id must resolve to null, distinct from an empty array");

    // --- Scenario A from the ticket: migrated article, all media owned by
    // ADMIN, article authored by someone else entirely. Article Media must
    // still surface every referenced asset — it is not an ownership filter. ---
    const admin = await createUser("admin", "ADMIN");
    const author = await createUser("author");
    const mediaA = await createAsset({ uploadedById: admin, sourceType: MediaSourceType.MIGRATED });
    const mediaB = await createAsset({ uploadedById: admin, sourceType: MediaSourceType.MIGRATED });
    const mediaC = await createAsset({ uploadedById: admin, sourceType: MediaSourceType.MIGRATED });

    const migratedArticleId = await createArticle({
      authorUserId: author,
      coverImageId: mediaA,
      blocks: [
        { id: "b1", type: "image", mediaId: mediaB, alt: "", caption: "" },
        { id: "b2", type: "gallery", mediaIds: [mediaC], presentation: "carousel", caption: "" },
      ],
    });

    const migratedItems = await getArticleMediaItems(migratedArticleId);
    assert.ok(migratedItems, "existing article must not resolve to null");
    assert.deepEqual(
      new Set(migratedItems!.map((i) => i.id)),
      new Set([mediaA, mediaB, mediaC]),
      "all three ADMIN-owned migrated assets must appear despite authorUserId being a different user",
    );
    const coverItem = migratedItems!.find((i) => i.id === mediaA);
    assert.deepEqual(coverItem?.usage, ["cover"]);

    // --- Scenario: dedup — same MediaAsset used as cover AND inside a gallery
    // block must appear exactly once, with usage covering both places. ---
    const sharedMedia = await createAsset({ uploadedById: author });
    const dedupArticleId = await createArticle({
      authorUserId: author,
      coverImageId: sharedMedia,
      blocks: [{ id: "b1", type: "gallery", mediaIds: [sharedMedia], presentation: "carousel", caption: "" }],
    });
    const dedupItems = await getArticleMediaItems(dedupArticleId);
    assert.equal(dedupItems!.length, 1, "same MediaAsset referenced twice must appear exactly once");
    assert.deepEqual(dedupItems![0].usage.sort(), ["cover", "gallery-block"].sort());

    // --- Scenario: no references at all → empty array (not null) ---
    const emptyArticleId = await createArticle({ authorUserId: author });
    const emptyItems = await getArticleMediaItems(emptyArticleId);
    assert.deepEqual(emptyItems, []);

    // --- Scenario: a referenced MediaAsset without a publicUrl is skipped
    // (picker can't render a tile with no image to show) rather than crashing
    // or returning a broken entry. ---
    const noUrlMedia = await createAsset({ uploadedById: author, publicUrl: null });
    const noUrlArticleId = await createArticle({ authorUserId: author, coverImageId: noUrlMedia });
    const noUrlItems = await getArticleMediaItems(noUrlArticleId);
    assert.deepEqual(noUrlItems, []);

    console.log("articleMediaLibrary.test.ts: OK");
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
