import assert from "node:assert/strict";

import type { Article } from "@prisma/client";

import { ArticleCommitWriter } from "./ArticleCommitWriter";
import type { ArticleCommitWriterPrismaClient } from "./ArticleCommitWriter";
import type { ArticleCreateDraft } from "./buildArticleCreateDraft";

function draftFixture(overrides: Partial<ArticleCreateDraft> = {}): ArticleCreateDraft {
  return {
    title: "Hello Article",
    slug: "hello-article",
    excerpt: "Some rich content",
    publishedAt: "2026-01-01 00:00:00",
    status: "DRAFT",
    seoTitle: "SEO Title",
    seoDescription: "SEO description",
    seoCanonicalUrl: "https://example.com/hello-article",
    seoRobots: "index, follow",
    seoOgTitle: "OG Title",
    seoOgDescription: "OG description",
    authorUserId: null,
    authorLabel: null,
    contentJson: {
      version: 1,
      blocks: [{ id: "lossy-content-block", type: "text", text: "Some rich content about kids activities." }],
    },
    ...overrides,
  };
}

function articleFixture(overrides: Partial<Article> = {}): Article {
  return {
    id: "article-1",
    slug: "hello-article",
    slugUpdatedAt: null,
    title: "Hello Article",
    subtitle: null,
    excerpt: "Some rich content",
    contentJson: { version: 1, blocks: [{ id: "lossy-content-block", type: "text", text: "Some rich content about kids activities." }] },
    heroImage: null,
    coverImageId: null,
    authorUserId: null,
    authorLabel: null,
    cityContext: null,
    cityId: null,
    geoScope: null,
    expiresAt: null,
    scheduledAt: null,
    seoTitle: "SEO Title",
    seoDescription: "SEO description",
    seoH1: null,
    seoCanonicalUrl: "https://example.com/hello-article",
    seoOgTitle: "OG Title",
    seoOgDescription: "OG description",
    seoOgImage: null,
    seoImageId: null,
    seoRobots: "index, follow",
    seoJsonLdOverride: null,
    publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    status: "DRAFT",
    noindex: false,
    views: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    seoCanonicalSource: "FALLBACK",
    relatedPlaceId: null,
    categoryId: null,
    ...overrides,
  } as Article;
}

function createFakeClient(
  options: { createdArticle?: Article; updatedArticle?: Article; throwError?: Error } = {},
) {
  const createCalls: unknown[] = [];
  const updateCalls: unknown[] = [];
  const client: ArticleCommitWriterPrismaClient = {
    article: {
      create: (async (args: unknown) => {
        createCalls.push(args);
        if (options.throwError) {
          throw options.throwError;
        }
        return options.createdArticle ?? articleFixture();
      }) as unknown as ArticleCommitWriterPrismaClient["article"]["create"],
      update: (async (args: unknown) => {
        updateCalls.push(args);
        if (options.throwError) {
          throw options.throwError;
        }
        return options.updatedArticle ?? articleFixture();
      }) as unknown as ArticleCommitWriterPrismaClient["article"]["update"],
    },
  };
  return { client, createCalls, updateCalls };
}

async function testSuccessfulCreate() {
  const { client, createCalls } = createFakeClient({ createdArticle: articleFixture({ id: "article-42" }) });
  const writer = new ArticleCommitWriter(client);

  const result = await writer.createArticleFromDraft(draftFixture());

  assert.equal(createCalls.length, 1);
  assert.deepEqual(result, { ok: true, articleId: "article-42" });
}

async function testPrismaReceivesExpectedCreatePayload() {
  const { client, createCalls } = createFakeClient();
  const writer = new ArticleCommitWriter(client);
  await writer.createArticleFromDraft(draftFixture());

  const call = createCalls[0] as { data: Record<string, unknown> };
  assert.equal(call.data.title, "Hello Article");
  assert.equal(call.data.slug, "hello-article");
  assert.equal(call.data.excerpt, "Some rich content");
  assert.ok(call.data.publishedAt instanceof Date);
  assert.equal(call.data.publishedAt.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(call.data.status, "DRAFT");
  assert.equal(call.data.seoTitle, "SEO Title");
  assert.equal(call.data.seoDescription, "SEO description");
  assert.equal(call.data.seoCanonicalUrl, "https://example.com/hello-article");
  assert.equal(call.data.seoRobots, "index, follow");
  assert.equal(call.data.seoOgTitle, "OG Title");
  assert.equal(call.data.seoOgDescription, "OG description");
  assert.equal(call.data.authorUserId, null);
  assert.equal(call.data.authorLabel, null);
  assert.deepEqual(call.data.contentJson, draftFixture().contentJson);
}

async function testExactPayloadFieldSet() {
  const { client, createCalls } = createFakeClient();
  const writer = new ArticleCommitWriter(client);
  await writer.createArticleFromDraft(draftFixture());

  const call = createCalls[0] as { data: Record<string, unknown> };
  assert.deepEqual(
    new Set(Object.keys(call.data)),
    new Set([
      "title",
      "slug",
      "excerpt",
      "publishedAt",
      "status",
      "seoTitle",
      "seoDescription",
      "seoCanonicalUrl",
      "seoRobots",
      "seoOgTitle",
      "seoOgDescription",
      "authorUserId",
      "authorLabel",
      "contentJson",
    ]),
  );
}

async function testCreateFailureReturnsOkFalse() {
  const createError = new Error("Unique constraint failed on the fields: (`cityId`,`slug`)");
  const { client } = createFakeClient({ throwError: createError });
  const writer = new ArticleCommitWriter(client);

  const result = await writer.createArticleFromDraft(draftFixture());

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errorCode, "ARTICLE_CREATE_FAILED");
  assert.equal(result.errorMessage, "Unique constraint failed on the fields: (`cityId`,`slug`)");
}

async function testUnknownPrismaErrorMapped() {
  const { client } = createFakeClient({ throwError: "not an Error instance" as unknown as Error });
  const writer = new ArticleCommitWriter(client);

  const result = await writer.createArticleFromDraft(draftFixture());

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errorCode, "ARTICLE_CREATE_FAILED");
  assert.equal(result.errorMessage, "not an Error instance");
}

async function testOnlyArticleDelegateExists() {
  const { client } = createFakeClient();
  assert.deepEqual(Object.keys(client), ["article"]);
}

async function testNeverTouchesMigrationRecordOrLineageOrSlugHistory() {
  const { client, createCalls } = createFakeClient();
  const writer = new ArticleCommitWriter(client);
  await writer.createArticleFromDraft(draftFixture());

  const call = createCalls[0] as { data: Record<string, unknown> };
  for (const forbiddenKey of [
    "migrationRecord",
    "migrationLineage",
    "slugHistory",
    "coverImageId",
    "categoryId",
    "tags",
    "relatedPlaceId",
    "cityId",
    "geoScope",
  ]) {
    assert.ok(!(forbiddenKey in call.data), `data must never include "${forbiddenKey}"`);
  }
  // Structural proof: the injected client type only exposes `article`, so
  // there is nothing resembling migrationRecord/migrationLineage to call.
  assert.deepEqual(Object.keys(client), ["article"]);
}

async function testMissingTitleThrows() {
  const { client } = createFakeClient();
  const writer = new ArticleCommitWriter(client);
  await assert.rejects(() => writer.createArticleFromDraft(draftFixture({ title: "  " })));
}

async function testUpdateOnlyRefreshesContentFields() {
  const { client, updateCalls } = createFakeClient({ updatedArticle: articleFixture({ id: "article-42" }) });
  const writer = new ArticleCommitWriter(client);
  const draft = draftFixture({
    title: "Changed title should not overwrite",
    slug: "changed-slug-should-not-overwrite",
    excerpt: "Updated excerpt",
    contentJson: { version: 1, blocks: [{ id: "b1", type: "text", text: "Updated body" }] },
  });

  const result = await writer.updateArticleFromDraft("article-42", draft);

  assert.deepEqual(result, { ok: true, articleId: "article-42" });
  const call = updateCalls[0] as { where: { id: string }; data: Record<string, unknown> };
  assert.equal(call.where.id, "article-42");
  assert.deepEqual(new Set(Object.keys(call.data)), new Set(["excerpt", "contentJson"]));
  assert.equal(call.data.excerpt, "Updated excerpt");
  assert.deepEqual(call.data.contentJson, draft.contentJson);
}

async function testUpdateFailureReturnsTypedError() {
  const { client } = createFakeClient({ throwError: new Error("update failed") });
  const writer = new ArticleCommitWriter(client);
  const result = await writer.updateArticleFromDraft("article-1", draftFixture());
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errorCode, "ARTICLE_UPDATE_FAILED");
}

async function main() {
  await testSuccessfulCreate();
  await testPrismaReceivesExpectedCreatePayload();
  await testExactPayloadFieldSet();
  await testCreateFailureReturnsOkFalse();
  await testUnknownPrismaErrorMapped();
  await testOnlyArticleDelegateExists();
  await testNeverTouchesMigrationRecordOrLineageOrSlugHistory();
  await testMissingTitleThrows();
  await testUpdateOnlyRefreshesContentFields();
  await testUpdateFailureReturnsTypedError();
}

main()
  .then(() => {
    console.log("ArticleCommitWriter tests: OK");
  })
  .catch((error) => {
    console.error("ArticleCommitWriter tests: FAILED", error);
    process.exitCode = 1;
  });
