import assert from "node:assert/strict";

import type { MigrationRecord } from "@prisma/client";

import { ArticleCommitRunner } from "./ArticleCommitRunner";
import type {
  ArticleCommitOrchestratorLike,
  ArticleCommitRunnerPrismaClient,
  ExecuteArticleCommitRunInput,
  MigrationLineageWriterLike,
} from "./ArticleCommitRunner";
import type { ExecuteArticleCommitResult } from "./ArticleCommitOrchestrator";
import type { CreateLineageResult } from "../../lineage/types";
import type { ArticleCommitContext, NormalizedArticleCandidate } from "./buildArticleCreateDraft";

function migrationRecordFixture(overrides: Partial<MigrationRecord> = {}): MigrationRecord {
  return {
    id: "record-1",
    sourceId: "source-1",
    runId: "run-1",
    status: "PLANNED",
    sourceEntityType: "wordpress-db:post",
    sourceExternalId: null,
    sourceStableKey: "wordpress-db:post:201",
    sourceRecordKey: "wordpress-db:post:201",
    sourceUrl: null,
    canonicalSourceUrl: null,
    sourceUpdatedAt: null,
    sourceHash: "hash-a",
    rawPayloadRef: null,
    rawPayload: null,
    normalizedPayloadRef: null,
    normalizedPayload: null,
    targetTypeHint: "ARTICLE",
    planAction: "CREATE",
    planSummary: { title: "Hello Article", slug: "hello-article" },
    validationSummary: null,
    dependencyRefs: null,
    mediaRefs: null,
    relationRefs: null,
    redirectRefs: null,
    attemptCount: 0,
    lastErrorCode: null,
    lastErrorMessage: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function candidateFixture(overrides: Partial<NormalizedArticleCandidate> = {}): NormalizedArticleCandidate {
  return {
    title: "Hello Article",
    slug: "hello-article",
    content: "<p>Some rich content about kids activities.</p>",
    excerpt: "Some rich content",
    status: "publish",
    publishedAt: "2026-01-01 00:00:00",
    modifiedAt: "2026-01-02 00:00:00",
    seo: {
      title: "SEO Title",
      description: "SEO description",
      focusKeyword: "kids",
      canonicalUrl: "https://example.com/hello-article",
      robots: "index, follow",
      ogTitle: "OG Title",
      ogDescription: "OG description",
    },
    featuredImageAttachmentId: 555,
    inlineImageAttachmentIds: [111, 222],
    oldSlugs: [],
    hasElementorContent: false,
    hasWebStoryContent: false,
    sourceTerms: [{ termId: 10, taxonomy: "category", name: "News", slug: "news" }],
    rawMeta: {},
    ...overrides,
  };
}

function contextFixture(overrides: Partial<ArticleCommitContext> = {}): ArticleCommitContext {
  return { ...overrides };
}

function inputFixture(overrides: Partial<ExecuteArticleCommitRunInput> = {}): ExecuteArticleCommitRunInput {
  return {
    operation: {
      recordId: "record-1",
      sourceRecordKey: "wordpress-db:post:201",
      targetType: "ARTICLE",
      action: "CREATE",
      order: 0,
      dependsOn: [],
      rollbackSteps: [],
    },
    candidate: candidateFixture(),
    context: contextFixture(),
    migrationRecord: migrationRecordFixture(),
    ...overrides,
  };
}

function createFakeOrchestrator(result: ExecuteArticleCommitResult) {
  const calls: unknown[] = [];
  const orchestrator: ArticleCommitOrchestratorLike = {
    execute: async (input) => {
      calls.push(input);
      return result;
    },
  };
  return { orchestrator, calls };
}

function createFakeLineageWriter(options: { result?: CreateLineageResult; throwError?: Error } = {}) {
  const calls: unknown[] = [];
  const writer: MigrationLineageWriterLike = {
    createLineage: async (input) => {
      calls.push(input);
      if (options.throwError) {
        throw options.throwError;
      }
      return (
        options.result ?? {
          lineageId: "lineage-1",
          sourceRecordKey: input.sourceRecordKey,
          targetType: input.targetType,
          targetId: input.targetId,
        }
      );
    },
  };
  return { writer, calls };
}

function createFakePrisma(
  options: {
    throwError?: Error;
    existingLineage?: { id: string; targetId: string; lastImportedAt?: Date } | null;
  } = {},
) {
  const recordUpdateCalls: unknown[] = [];
  const lineageFindCalls: unknown[] = [];
  const lineageUpdateCalls: unknown[] = [];
  const importedAt = options.existingLineage?.lastImportedAt ?? new Date("2026-08-01T00:00:00.000Z");
  const prisma: ArticleCommitRunnerPrismaClient = {
    migrationRecord: {
      update: (async (args: unknown) => {
        recordUpdateCalls.push(args);
        if (options.throwError) {
          throw options.throwError;
        }
        return migrationRecordFixture();
      }) as unknown as ArticleCommitRunnerPrismaClient["migrationRecord"]["update"],
    },
    migrationLineage: {
      findFirst: (async (args: unknown) => {
        lineageFindCalls.push(args);
        return options.existingLineage
          ? ({
              id: options.existingLineage.id,
              sourceRecordKey: "wordpress-db:post:201",
              targetType: "ARTICLE",
              targetId: options.existingLineage.targetId,
              lastImportedAt: importedAt,
            } as unknown)
          : null;
      }) as unknown as ArticleCommitRunnerPrismaClient["migrationLineage"]["findFirst"],
      update: (async (args: unknown) => {
        lineageUpdateCalls.push(args);
        if (options.throwError) {
          throw options.throwError;
        }
        return {
          id: "lineage-1",
          sourceRecordKey: "wordpress-db:post:201",
          targetType: "ARTICLE",
          targetId: "article-1",
        } as unknown;
      }) as unknown as ArticleCommitRunnerPrismaClient["migrationLineage"]["update"],
    },
    article: {
      findUnique: (async () =>
        options.existingLineage
          ? { id: options.existingLineage.targetId, updatedAt: importedAt }
          : null) as unknown as ArticleCommitRunnerPrismaClient["article"]["findUnique"],
    },
  };
  return { prisma, recordUpdateCalls, lineageFindCalls, lineageUpdateCalls };
}

async function testHappyPathCreatesLineageAndMarksLinked() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, status: "CREATED", articleId: "article-1" });
  const { writer: lineageWriter, calls: lineageCalls } = createFakeLineageWriter();
  const { prisma, recordUpdateCalls } = createFakePrisma();
  const runner = new ArticleCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture());

  assert.equal(result.ok, true);
  assert.equal(result.articleId, "article-1");
  assert.equal(result.lineageId, "lineage-1");
  assert.equal(result.recordId, "record-1");
  assert.equal(result.status, "LINKED");

  assert.equal(lineageCalls.length, 1);
  assert.equal((lineageCalls[0] as { targetType: string }).targetType, "ARTICLE");
  assert.equal(recordUpdateCalls.length, 1);
  const updateCall = recordUpdateCalls[0] as { where: { id: string }; data: Record<string, unknown> };
  assert.equal(updateCall.where.id, "record-1");
  assert.deepEqual(updateCall.data, { status: "LINKED", lastErrorCode: null, lastErrorMessage: null });
}

async function testOrchestratorBlockedMarksFailedWithArticleBlockedAndSkipsLineage() {
  const { orchestrator } = createFakeOrchestrator({
    ok: false,
    status: "BLOCKED",
    blockReasons: [{ code: "MISSING_TITLE", message: "NormalizedArticleCandidate.title is empty." }],
  });
  const { writer: lineageWriter, calls: lineageCalls } = createFakeLineageWriter();
  const { prisma, recordUpdateCalls } = createFakePrisma();
  const runner = new ArticleCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture());

  assert.equal(result.ok, false);
  assert.equal(result.status, "FAILED");
  assert.equal(result.errorCode, "ARTICLE_BLOCKED");
  assert.match(result.errorMessage ?? "", /MISSING_TITLE/);
  assert.equal(lineageCalls.length, 0, "lineage must never be written for a blocked draft");

  const updateCall = recordUpdateCalls[0] as { data: Record<string, unknown> };
  assert.equal(updateCall.data.status, "FAILED");
  assert.equal(updateCall.data.lastErrorCode, "ARTICLE_BLOCKED");
  assert.match(updateCall.data.lastErrorMessage as string, /MISSING_TITLE/);
}

async function testOrchestratorFailedMarksFailedWithWriterErrorCodeAndSkipsLineage() {
  const { orchestrator } = createFakeOrchestrator({
    ok: false,
    status: "FAILED",
    errorCode: "ARTICLE_CREATE_FAILED",
    errorMessage: "db unavailable",
  });
  const { writer: lineageWriter, calls: lineageCalls } = createFakeLineageWriter();
  const { prisma, recordUpdateCalls } = createFakePrisma();
  const runner = new ArticleCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture());

  assert.equal(result.ok, false);
  assert.equal(result.status, "FAILED");
  assert.equal(result.errorCode, "ARTICLE_CREATE_FAILED");
  assert.equal(result.errorMessage, "db unavailable");
  assert.equal(lineageCalls.length, 0);

  const updateCall = recordUpdateCalls[0] as { data: Record<string, unknown> };
  assert.equal(updateCall.data.lastErrorCode, "ARTICLE_CREATE_FAILED");
  assert.equal(updateCall.data.lastErrorMessage, "db unavailable");
}

async function testLineageFailureMarksFailedWithLineageWriteFailed() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, status: "CREATED", articleId: "article-1" });
  const { writer: lineageWriter } = createFakeLineageWriter({ throwError: new Error("lineage db down") });
  const { prisma, recordUpdateCalls } = createFakePrisma();
  const runner = new ArticleCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture());

  assert.equal(result.ok, false);
  assert.equal(result.status, "FAILED");
  assert.equal(result.errorCode, "LINEAGE_WRITE_FAILED");
  assert.equal(result.errorMessage, "lineage db down");
  assert.equal(result.articleId, "article-1", "the already-created Article must still be reported, never hidden or rolled back");

  const updateCall = recordUpdateCalls[0] as { data: Record<string, unknown> };
  assert.equal(updateCall.data.status, "FAILED");
  assert.equal(updateCall.data.lastErrorCode, "LINEAGE_WRITE_FAILED");
  assert.equal(updateCall.data.lastErrorMessage, "lineage db down");
}

async function testMigrationRecordUpdateThrowPropagatesRaw() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, status: "CREATED", articleId: "article-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma } = createFakePrisma({ throwError: new Error("update failed") });
  const runner = new ArticleCommitRunner({ orchestrator, lineageWriter, prisma });

  await assert.rejects(() => runner.execute(inputFixture()), /update failed/);
}

async function testArticleIdNeverWrittenToMigrationRecord() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, status: "CREATED", articleId: "article-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma, recordUpdateCalls } = createFakePrisma();
  const runner = new ArticleCommitRunner({ orchestrator, lineageWriter, prisma });

  await runner.execute(inputFixture());

  const updateCall = recordUpdateCalls[0] as { data: Record<string, unknown> };
  assert.ok(!("articleId" in updateCall.data));
  assert.ok(!("targetId" in updateCall.data));
}

async function testPlanSummaryNormalizedAndRawPayloadNeverTouched() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, status: "CREATED", articleId: "article-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma, recordUpdateCalls } = createFakePrisma();
  const runner = new ArticleCommitRunner({ orchestrator, lineageWriter, prisma });

  await runner.execute(inputFixture());

  const updateCall = recordUpdateCalls[0] as { data: Record<string, unknown> };
  assert.deepEqual(
    new Set(Object.keys(updateCall.data)),
    new Set(["status", "lastErrorCode", "lastErrorMessage"]),
    "the update payload must only ever touch execution-status fields",
  );
  assert.ok(!("planSummary" in updateCall.data));
  assert.ok(!("normalizedPayload" in updateCall.data));
  assert.ok(!("rawPayload" in updateCall.data));
}

async function testNoMediaSlugHistoryCategoryTagsGeoDelegatesExistOrTouched() {
  // Prisma surface is ledger + Article timestamp gate. Media still goes through
  // the injected ArticleFullMediaSyncer, not extra article writer delegates.
  const { prisma } = createFakePrisma();
  assert.deepEqual(Object.keys(prisma), ["migrationRecord", "migrationLineage", "article"]);
}

async function testWarningsAreDeliberatelyNotExposedOnRunnerResult() {
  const { orchestrator } = createFakeOrchestrator({
    ok: true,
    status: "CREATED",
    articleId: "article-1",
    warnings: [{ code: "CONTENT_NORMALIZED_WITH_LIMITATIONS", message: "content normalized" }],
  });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma } = createFakePrisma();
  const runner = new ArticleCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture());

  assert.ok(
    !("warnings" in result),
    "the runner deliberately does not expose draft warnings on its own result — nothing downstream reads them yet",
  );
}

async function testExistingLineageAndUpdateActionUsesUpdateFlow() {
  const { orchestrator, calls: orchestratorCalls } = createFakeOrchestrator({
    ok: true,
    status: "UPDATED",
    articleId: "article-1",
  });
  const { writer: lineageWriter, calls: lineageCreateCalls } = createFakeLineageWriter();
  const { prisma, lineageFindCalls, lineageUpdateCalls } = createFakePrisma({
    existingLineage: { id: "lineage-1", targetId: "article-1" },
  });
  const runner = new ArticleCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(
    inputFixture({
      operation: {
        recordId: "record-1",
        sourceRecordKey: "wordpress-db:post:201",
        targetType: "ARTICLE",
        action: "UPDATE",
        order: 0,
        dependsOn: [],
        rollbackSteps: [],
      },
    }),
  );

  assert.equal(result.ok, true);
  assert.equal(orchestratorCalls.length, 1);
  const orchestratorCall = orchestratorCalls[0] as { action?: string; targetArticleId?: string | null };
  assert.equal(orchestratorCall.action, "UPDATE");
  assert.equal(orchestratorCall.targetArticleId, "article-1");
  assert.equal(lineageFindCalls.length, 1);
  assert.equal(lineageUpdateCalls.length, 1);
  assert.equal(lineageCreateCalls.length, 0, "lineage row must be updated, never duplicated");
}

async function testUpdateWithoutExistingLineageFails() {
  const { orchestrator, calls: orchestratorCalls } = createFakeOrchestrator({ ok: true, status: "UPDATED", articleId: "article-1" });
  const { writer: lineageWriter, calls: lineageCreateCalls } = createFakeLineageWriter();
  const { prisma, recordUpdateCalls } = createFakePrisma({ existingLineage: null });
  const runner = new ArticleCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(
    inputFixture({
      operation: {
        recordId: "record-1",
        sourceRecordKey: "wordpress-db:post:201",
        targetType: "ARTICLE",
        action: "UPDATE",
        order: 0,
        dependsOn: [],
        rollbackSteps: [],
      },
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "ARTICLE_UPDATE_TARGET_MISSING");
  assert.equal(orchestratorCalls.length, 0);
  assert.equal(lineageCreateCalls.length, 0);
  assert.equal(recordUpdateCalls.length, 1);
}

async function main() {
  await testHappyPathCreatesLineageAndMarksLinked();
  await testOrchestratorBlockedMarksFailedWithArticleBlockedAndSkipsLineage();
  await testOrchestratorFailedMarksFailedWithWriterErrorCodeAndSkipsLineage();
  await testLineageFailureMarksFailedWithLineageWriteFailed();
  await testMigrationRecordUpdateThrowPropagatesRaw();
  await testArticleIdNeverWrittenToMigrationRecord();
  await testPlanSummaryNormalizedAndRawPayloadNeverTouched();
  await testNoMediaSlugHistoryCategoryTagsGeoDelegatesExistOrTouched();
  await testWarningsAreDeliberatelyNotExposedOnRunnerResult();
  await testExistingLineageAndUpdateActionUsesUpdateFlow();
  await testUpdateWithoutExistingLineageFails();
}

main()
  .then(() => {
    console.log("ArticleCommitRunner tests: OK");
  })
  .catch((error) => {
    console.error("ArticleCommitRunner tests: FAILED", error);
    process.exitCode = 1;
  });
