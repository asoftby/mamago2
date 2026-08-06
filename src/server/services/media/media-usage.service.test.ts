/** Run: tsx src/server/services/media/media-usage.service.test.ts (assert-based, project convention). */
import assert from "node:assert/strict";
import { MediaEntityType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  ARTICLE_CONTENT_MEDIA_USAGE_FIELD,
  syncArticleContentMediaUsages,
  syncArticleMediaUsage,
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

// ---------------------------------------------------------------------------
// syncArticleMediaUsage — reads/writes via the real `prisma` singleton
// (no injectable client), so this suite monkey-patches `prisma.$transaction`
// only: everything the function does happens through the `tx` argument that
// callback receives, so overriding just `$transaction` is enough to fully
// fake the database for it, restored after every test. No real DB access.
// ---------------------------------------------------------------------------

interface FakeArticleRow {
  coverImageId: string | null;
  seoImageId: string | null;
  contentJson: unknown;
}

function stubArticleMediaUsageTransaction(options: {
  article: FakeArticleRow | null;
  initialUsageRows?: FakeUsageRow[];
  failOnFieldCreate?: string;
}): {
  getUsageRows: () => FakeUsageRow[];
  getCreateManyCallCount: () => number;
  getDeleteManyCallCount: () => number;
  restore: () => void;
} {
  let usageRows: FakeUsageRow[] = [...(options.initialUsageRows ?? [])];
  let createManyCalls = 0;
  let deleteManyCalls = 0;
  const original = prisma.$transaction;

  const txClient = {
    article: {
      findUnique: (async () => options.article) as unknown as ArticleContentMediaUsageSyncTxClient,
    },
    mediaUsage: {
      deleteMany: (async (args: { where: { entityType: MediaEntityType; entityId: string; field: string | { in: string[] } } }) => {
        deleteManyCalls++;
        const fieldMatches = (field: string) =>
          typeof args.where.field === "string" ? field === args.where.field : args.where.field.in.includes(field);
        const before = usageRows.length;
        usageRows = usageRows.filter((r) => !(r.entityType === args.where.entityType && r.entityId === args.where.entityId && fieldMatches(r.field)));
        return { count: before - usageRows.length };
      }) as unknown as ArticleContentMediaUsageSyncTxClient["mediaUsage"]["deleteMany"],
      createMany: (async (args: { data: FakeUsageRow[] }) => {
        createManyCalls++;
        if (options.failOnFieldCreate && args.data.some((d) => d.field === options.failOnFieldCreate)) {
          throw new Error(`Simulated failure creating field "${options.failOnFieldCreate}"`);
        }
        usageRows.push(...args.data);
        return { count: args.data.length };
      }) as unknown as ArticleContentMediaUsageSyncTxClient["mediaUsage"]["createMany"],
    },
  };

  prisma.$transaction = (async (fn: (tx: unknown) => Promise<unknown>) => {
    // Mirrors a real transaction: any throw inside `fn` must leave
    // `usageRows` exactly as it was before this attempt, never a partial set.
    const snapshot = usageRows;
    try {
      return await fn(txClient);
    } catch (error) {
      usageRows = snapshot;
      throw error;
    }
  }) as unknown as typeof prisma.$transaction;

  return {
    getUsageRows: () => usageRows,
    getCreateManyCallCount: () => createManyCalls,
    getDeleteManyCallCount: () => deleteManyCalls,
    restore: () => {
      prisma.$transaction = original;
    },
  };
}

async function testSyncArticleMediaUsageCreatesCoverSeoInlineAndGallery() {
  const harness = stubArticleMediaUsageTransaction({
    article: {
      coverImageId: "media-cover",
      seoImageId: "media-seo",
      contentJson: content([
        { id: "b1", type: "image", mediaId: "media-inline" },
        { id: "b2", type: "gallery", mediaIds: ["media-gallery-1", "media-gallery-2"] },
      ]),
    },
  });
  try {
    const result = await syncArticleMediaUsage("article-1");
    assert.deepEqual([...result.mediaIds].sort(), ["media-cover", "media-gallery-1", "media-gallery-2", "media-inline", "media-seo"].sort());

    const rows = harness.getUsageRows();
    const byField = (field: string) => rows.filter((r) => r.field === field).map((r) => r.mediaId);
    assert.deepEqual(byField("coverImageId"), ["media-cover"]);
    assert.deepEqual(byField("seoImageId"), ["media-seo"]);
    assert.deepEqual(byField(ARTICLE_CONTENT_MEDIA_USAGE_FIELD).sort(), ["media-gallery-1", "media-gallery-2", "media-inline"].sort());
  } finally {
    harness.restore();
  }
}

async function testFullSyncRebuildsContentFieldRatherThanErasingIt() {
  const harness = stubArticleMediaUsageTransaction({
    article: { coverImageId: null, seoImageId: null, contentJson: content([{ id: "b1", type: "image", mediaId: "media-inline" }]) },
    initialUsageRows: [{ mediaId: "media-stale-content", entityType: MediaEntityType.ARTICLE, entityId: "article-1", field: ARTICLE_CONTENT_MEDIA_USAGE_FIELD }],
  });
  try {
    await syncArticleMediaUsage("article-1");
    const rows = harness.getUsageRows();
    assert.equal(rows.length, 1, "the field survives a full sync — it's rebuilt from contentJson, never left deleted");
    assert.equal(rows[0].mediaId, "media-inline", "rebuilt to match the article's actual current contentJson, not left as the stale pre-sync value");
  } finally {
    harness.restore();
  }
}

async function testRemovedImageDropsCorrespondingContentUsage() {
  const harness = stubArticleMediaUsageTransaction({
    article: { coverImageId: null, seoImageId: null, contentJson: content([]) },
    initialUsageRows: [{ mediaId: "media-removed", entityType: MediaEntityType.ARTICLE, entityId: "article-1", field: ARTICLE_CONTENT_MEDIA_USAGE_FIELD }],
  });
  try {
    await syncArticleMediaUsage("article-1");
    assert.deepEqual(harness.getUsageRows(), [], "an image no longer in contentJson has its usage row removed");
  } finally {
    harness.restore();
  }
}

async function testUnknownFutureFieldIsPreserved() {
  const harness = stubArticleMediaUsageTransaction({
    article: { coverImageId: "media-cover", seoImageId: null, contentJson: content([]) },
    initialUsageRows: [{ mediaId: "media-future", entityType: MediaEntityType.ARTICLE, entityId: "article-1", field: "customField" }],
  });
  try {
    await syncArticleMediaUsage("article-1");
    const rows = harness.getUsageRows();
    assert.ok(rows.some((r) => r.field === "customField" && r.mediaId === "media-future"), "a field this function doesn't know about must survive untouched");
    assert.ok(rows.some((r) => r.field === "coverImageId" && r.mediaId === "media-cover"));
  } finally {
    harness.restore();
  }
}

async function testPreservesUsagesOfAnotherArticleViaFullSync() {
  const harness = stubArticleMediaUsageTransaction({
    article: { coverImageId: "media-cover", seoImageId: null, contentJson: content([]) },
    initialUsageRows: [{ mediaId: "media-other", entityType: MediaEntityType.ARTICLE, entityId: "article-OTHER", field: "coverImageId" }],
  });
  try {
    await syncArticleMediaUsage("article-1");
    const rows = harness.getUsageRows();
    assert.ok(rows.some((r) => r.entityId === "article-OTHER" && r.mediaId === "media-other"), "another Article's row is untouched");
  } finally {
    harness.restore();
  }
}

async function testPreservesUsagesOfAnotherEntityType() {
  const harness = stubArticleMediaUsageTransaction({
    article: { coverImageId: "media-cover", seoImageId: null, contentJson: content([]) },
    initialUsageRows: [{ mediaId: "media-place", entityType: MediaEntityType.PLACE, entityId: "place-1", field: "logoImageId" }],
  });
  try {
    await syncArticleMediaUsage("article-1");
    const rows = harness.getUsageRows();
    assert.ok(rows.some((r) => r.entityType === MediaEntityType.PLACE && r.mediaId === "media-place"), "a different entity type's row is untouched");
  } finally {
    harness.restore();
  }
}

async function testSyncArticleMediaUsageIsIdempotent() {
  const harness = stubArticleMediaUsageTransaction({
    article: {
      coverImageId: "media-cover",
      seoImageId: "media-seo",
      contentJson: content([{ id: "b1", type: "image", mediaId: "media-inline" }]),
    },
  });
  try {
    await syncArticleMediaUsage("article-1");
    const firstPass = [...harness.getUsageRows()].sort((a, b) => a.mediaId.localeCompare(b.mediaId));
    await syncArticleMediaUsage("article-1");
    const secondPass = [...harness.getUsageRows()].sort((a, b) => a.mediaId.localeCompare(b.mediaId));
    assert.equal(secondPass.length, 3, "no duplicate rows accumulate across repeated syncs");
    assert.deepEqual(
      secondPass.map((r) => ({ mediaId: r.mediaId, field: r.field })),
      firstPass.map((r) => ({ mediaId: r.mediaId, field: r.field })),
    );
  } finally {
    harness.restore();
  }
}

async function testTransactionFailurePreservesOldUsageSet() {
  const harness = stubArticleMediaUsageTransaction({
    article: {
      coverImageId: "media-cover",
      seoImageId: null,
      contentJson: content([{ id: "b1", type: "image", mediaId: "media-inline" }]),
    },
    initialUsageRows: [{ mediaId: "media-old-cover", entityType: MediaEntityType.ARTICLE, entityId: "article-1", field: "coverImageId" }],
    failOnFieldCreate: ARTICLE_CONTENT_MEDIA_USAGE_FIELD,
  });
  try {
    await assert.rejects(() => syncArticleMediaUsage("article-1"), /Simulated failure creating field/);
    assert.deepEqual(
      harness.getUsageRows(),
      [{ mediaId: "media-old-cover", entityType: MediaEntityType.ARTICLE, entityId: "article-1", field: "coverImageId" }],
      "old usages survive exactly as they were — no partial set (new cover created, content failed) is left behind",
    );
  } finally {
    harness.restore();
  }
}

async function testArticleNotFoundThrowsWithZeroMutations() {
  const harness = stubArticleMediaUsageTransaction({
    article: null,
    initialUsageRows: [{ mediaId: "media-existing", entityType: MediaEntityType.ARTICLE, entityId: "article-1", field: "coverImageId" }],
  });
  try {
    await assert.rejects(() => syncArticleMediaUsage("article-1"), /Article article-1 not found/);
    assert.equal(harness.getDeleteManyCallCount(), 0, "no delete is ever attempted once the Article lookup itself fails");
    assert.equal(harness.getCreateManyCallCount(), 0);
    assert.deepEqual(harness.getUsageRows(), [{ mediaId: "media-existing", entityType: MediaEntityType.ARTICLE, entityId: "article-1", field: "coverImageId" }]);
  } finally {
    harness.restore();
  }
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
  await testSyncArticleMediaUsageCreatesCoverSeoInlineAndGallery();
  await testFullSyncRebuildsContentFieldRatherThanErasingIt();
  await testRemovedImageDropsCorrespondingContentUsage();
  await testUnknownFutureFieldIsPreserved();
  await testPreservesUsagesOfAnotherArticleViaFullSync();
  await testPreservesUsagesOfAnotherEntityType();
  await testSyncArticleMediaUsageIsIdempotent();
  await testTransactionFailurePreservesOldUsageSet();
  await testArticleNotFoundThrowsWithZeroMutations();
  console.log("media-usage.service tests: OK");
}

main().catch((error) => {
  console.error("media-usage.service tests: FAILED", error);
  process.exitCode = 1;
});
