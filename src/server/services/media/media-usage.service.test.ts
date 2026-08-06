/** Run: tsx src/server/services/media/media-usage.service.test.ts (assert-based, project convention). */
import assert from "node:assert/strict";
import { MediaEntityType } from "@prisma/client";

import {
  ARTICLE_CONTENT_MEDIA_USAGE_FIELD,
  syncArticleContentMediaUsages,
  type ArticleContentMediaUsageSyncTxClient,
} from "./media-usage.service";
import type { ArticleContentPayload } from "@/lib/publications/articleMvp";

interface FakeUsageRow {
  mediaId: string;
  entityType: MediaEntityType;
  entityId: string;
  field: string;
}

function createFakeTx(initialRows: FakeUsageRow[] = []): { tx: ArticleContentMediaUsageSyncTxClient; rows: () => FakeUsageRow[] } {
  let rows: FakeUsageRow[] = [...initialRows];

  const tx: ArticleContentMediaUsageSyncTxClient = {
    mediaUsage: {
      deleteMany: (async (args: { where: { entityType: MediaEntityType; entityId: string; field: string } }) => {
        const before = rows.length;
        rows = rows.filter(
          (r) => !(r.entityType === args.where.entityType && r.entityId === args.where.entityId && r.field === args.where.field),
        );
        return { count: before - rows.length };
      }) as unknown as ArticleContentMediaUsageSyncTxClient["mediaUsage"]["deleteMany"],
      createMany: (async (args: { data: FakeUsageRow[] }) => {
        rows.push(...args.data);
        return { count: args.data.length };
      }) as unknown as ArticleContentMediaUsageSyncTxClient["mediaUsage"]["createMany"],
    },
  };

  return { tx, rows: () => rows };
}

function content(blocks: ArticleContentPayload["blocks"]): ArticleContentPayload {
  return { version: 1, blocks };
}

async function testCreatesUsagesForImageAndGallery() {
  const { tx, rows } = createFakeTx();
  const result = await syncArticleContentMediaUsages({
    tx,
    articleId: "article-1",
    contentJson: content([
      { id: "b1", type: "image", mediaId: "media-1" },
      { id: "b2", type: "gallery", mediaIds: ["media-2", "media-3"] },
    ]),
  });

  assert.deepEqual(result.mediaIds, ["media-1", "media-2", "media-3"]);
  assert.deepEqual(
    rows().map((r) => r.mediaId).sort(),
    ["media-1", "media-2", "media-3"],
  );
  assert.ok(rows().every((r) => r.entityType === MediaEntityType.ARTICLE && r.entityId === "article-1" && r.field === ARTICLE_CONTENT_MEDIA_USAGE_FIELD));
}

async function testRemovesUsageWhenImageRemovedFromContent() {
  const { tx, rows } = createFakeTx();
  await syncArticleContentMediaUsages({
    tx,
    articleId: "article-1",
    contentJson: content([{ id: "b1", type: "image", mediaId: "media-1" }]),
  });
  assert.equal(rows().length, 1);

  await syncArticleContentMediaUsages({
    tx,
    articleId: "article-1",
    contentJson: content([]),
  });
  assert.deepEqual(rows(), []);
}

async function testPreservesUnrelatedUsageFields() {
  const { tx, rows } = createFakeTx([
    { mediaId: "media-cover", entityType: MediaEntityType.ARTICLE, entityId: "article-1", field: "coverImageId" },
    { mediaId: "media-seo", entityType: MediaEntityType.ARTICLE, entityId: "article-1", field: "seoImageId" },
  ]);

  await syncArticleContentMediaUsages({
    tx,
    articleId: "article-1",
    contentJson: content([{ id: "b1", type: "image", mediaId: "media-inline" }]),
  });

  const finalRows = rows();
  assert.ok(finalRows.some((r) => r.field === "coverImageId" && r.mediaId === "media-cover"), "cover usage untouched");
  assert.ok(finalRows.some((r) => r.field === "seoImageId" && r.mediaId === "media-seo"), "seo usage untouched");
  assert.ok(finalRows.some((r) => r.field === ARTICLE_CONTENT_MEDIA_USAGE_FIELD && r.mediaId === "media-inline"), "content usage created");
  assert.equal(finalRows.length, 3);
}

async function testPreservesUsagesOfAnotherArticle() {
  const { tx, rows } = createFakeTx([
    { mediaId: "media-other", entityType: MediaEntityType.ARTICLE, entityId: "article-OTHER", field: ARTICLE_CONTENT_MEDIA_USAGE_FIELD },
  ]);

  await syncArticleContentMediaUsages({
    tx,
    articleId: "article-1",
    contentJson: content([{ id: "b1", type: "image", mediaId: "media-1" }]),
  });

  const finalRows = rows();
  assert.ok(finalRows.some((r) => r.entityId === "article-OTHER" && r.mediaId === "media-other"), "other article's row survives untouched");
  assert.ok(finalRows.some((r) => r.entityId === "article-1" && r.mediaId === "media-1"));
  assert.equal(finalRows.length, 2);
}

async function testIdempotentRepeat() {
  const { tx, rows } = createFakeTx();
  const payload = content([
    { id: "b1", type: "image", mediaId: "media-1" },
    { id: "b2", type: "gallery", mediaIds: ["media-2"] },
  ]);

  await syncArticleContentMediaUsages({ tx, articleId: "article-1", contentJson: payload });
  const firstPass = [...rows()].sort((a, b) => a.mediaId.localeCompare(b.mediaId));

  await syncArticleContentMediaUsages({ tx, articleId: "article-1", contentJson: payload });
  const secondPass = [...rows()].sort((a, b) => a.mediaId.localeCompare(b.mediaId));

  assert.equal(secondPass.length, 2, "no duplicate rows accumulate across repeated syncs");
  assert.deepEqual(
    secondPass.map((r) => ({ mediaId: r.mediaId, entityType: r.entityType, entityId: r.entityId, field: r.field })),
    firstPass.map((r) => ({ mediaId: r.mediaId, entityType: r.entityType, entityId: r.entityId, field: r.field })),
  );
}

async function testDuplicateBlockReferencesBecomeOneLogicalUsage() {
  const { tx, rows } = createFakeTx();
  await syncArticleContentMediaUsages({
    tx,
    articleId: "article-1",
    contentJson: content([
      { id: "b1", type: "image", mediaId: "media-1" },
      { id: "b2", type: "gallery", mediaIds: ["media-1", "media-1"] },
      { id: "b3", type: "image", mediaId: "media-1" },
    ]),
  });

  const finalRows = rows();
  assert.equal(finalRows.length, 1, "the same media id referenced three times yields exactly one usage row");
  assert.equal(finalRows[0].mediaId, "media-1");
}

async function testEmptyContentRemovesOnlyManagedContentUsages() {
  const { tx, rows } = createFakeTx([
    { mediaId: "media-cover", entityType: MediaEntityType.ARTICLE, entityId: "article-1", field: "coverImageId" },
    { mediaId: "media-1", entityType: MediaEntityType.ARTICLE, entityId: "article-1", field: ARTICLE_CONTENT_MEDIA_USAGE_FIELD },
  ]);

  const result = await syncArticleContentMediaUsages({ tx, articleId: "article-1", contentJson: content([]) });

  assert.deepEqual(result.mediaIds, []);
  const finalRows = rows();
  assert.equal(finalRows.length, 1);
  assert.equal(finalRows[0].field, "coverImageId", "only the managed content-field row was removed");
}

async function testInvalidContentJsonSyncsToEmptySet() {
  const { tx, rows } = createFakeTx([
    { mediaId: "media-1", entityType: MediaEntityType.ARTICLE, entityId: "article-1", field: ARTICLE_CONTENT_MEDIA_USAGE_FIELD },
  ]);

  const result = await syncArticleContentMediaUsages({ tx, articleId: "article-1", contentJson: { garbage: true } });

  assert.deepEqual(result.mediaIds, []);
  assert.deepEqual(rows(), [], "fail-closed extractor means invalid content clears managed usages rather than guessing");
}

async function main() {
  await testCreatesUsagesForImageAndGallery();
  await testRemovesUsageWhenImageRemovedFromContent();
  await testPreservesUnrelatedUsageFields();
  await testPreservesUsagesOfAnotherArticle();
  await testIdempotentRepeat();
  await testDuplicateBlockReferencesBecomeOneLogicalUsage();
  await testEmptyContentRemovesOnlyManagedContentUsages();
  await testInvalidContentJsonSyncsToEmptySet();
  console.log("media-usage.service (syncArticleContentMediaUsages) tests: OK");
}

main().catch((error) => {
  console.error("media-usage.service tests: FAILED", error);
  process.exitCode = 1;
});
