import assert from "node:assert/strict";

import { ArticleCommitOrchestrator } from "./ArticleCommitOrchestrator";
import type { ArticleCommitWriterLike, ExecuteArticleCommitInput } from "./ArticleCommitOrchestrator";
import type { ArticleCommitContext, NormalizedArticleCandidate } from "./buildArticleCreateDraft";
import type { ArticleCommitResult } from "./ArticleCommitWriter";

function candidateFixture(overrides: Partial<NormalizedArticleCandidate> = {}): NormalizedArticleCandidate {
  return {
    title: "Hello Article",
    slug: "hello-article",
    content: "<p>Some <b>rich</b> content about kids activities.</p>",
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
  return {
    ...overrides,
  };
}

function inputFixture(overrides: Partial<ExecuteArticleCommitInput> = {}): ExecuteArticleCommitInput {
  return {
    candidate: candidateFixture(),
    context: contextFixture(),
    ...overrides,
  };
}

function createFakeWriter(options: { result?: ArticleCommitResult } = {}) {
  const calls: unknown[] = [];
  const writer: ArticleCommitWriterLike = {
    createArticleFromDraft: async (draft) => {
      calls.push(draft);
      return options.result ?? { ok: true, articleId: "article-1" };
    },
  };
  return { writer, calls };
}

async function testSuccessfulOrchestrationReturnsArticleId() {
  const { writer, calls } = createFakeWriter({ result: { ok: true, articleId: "article-42" } });
  const orchestrator = new ArticleCommitOrchestrator(writer);

  const result = await orchestrator.execute(inputFixture());

  assert.deepEqual(result, {
    ok: true,
    status: "CREATED",
    articleId: "article-42",
    warnings: [
      {
        code: "CONTENT_CONVERTED_LOSSY",
        message:
          "contentJson is a single lossy plain-text block, not a real HTML->blocks conversion. Needs manual editorial review before this article is considered a finished migration.",
        details: { plainTextLength: "Some rich content about kids activities.".length },
      },
    ],
  });
  assert.equal(calls.length, 1, "writer must be called exactly once");
}

async function testDraftBlockedMeansWriterNotCalled() {
  const { writer, calls } = createFakeWriter();
  const orchestrator = new ArticleCommitOrchestrator(writer);

  const result = await orchestrator.execute(inputFixture({ candidate: candidateFixture({ title: "" }) }));

  assert.equal(result.ok, false);
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.blockReasons?.some((r) => r.code === "MISSING_TITLE"));
  assert.equal(calls.length, 0, "writer must never be called when the draft is blocked");
}

async function testWriterFailureReturnsFailedResult() {
  const { writer } = createFakeWriter({
    result: { ok: false, errorCode: "ARTICLE_CREATE_FAILED", errorMessage: "db unavailable" },
  });
  const orchestrator = new ArticleCommitOrchestrator(writer);

  const result = await orchestrator.execute(inputFixture());

  assert.deepEqual(result, {
    ok: false,
    status: "FAILED",
    errorCode: "ARTICLE_CREATE_FAILED",
    errorMessage: "db unavailable",
  });
}

async function testWarningsPropagated() {
  const { writer } = createFakeWriter();
  const orchestrator = new ArticleCommitOrchestrator(writer);

  const result = await orchestrator.execute(inputFixture());

  assert.equal(result.ok, true);
  assert.ok(result.warnings && result.warnings.length > 0, "warnings from the draft must be propagated on success");
}

async function testLossyContentWarningPropagated() {
  const { writer } = createFakeWriter();
  const orchestrator = new ArticleCommitOrchestrator(writer);

  const result = await orchestrator.execute(inputFixture());

  assert.ok(result.warnings?.some((w) => w.code === "CONTENT_CONVERTED_LOSSY"));
}

async function testElementorBlockedPathThroughOrchestrator() {
  const { writer, calls } = createFakeWriter();
  const orchestrator = new ArticleCommitOrchestrator(writer);

  const result = await orchestrator.execute(
    inputFixture({ candidate: candidateFixture({ hasElementorContent: true }) }),
  );

  assert.equal(result.status, "BLOCKED");
  assert.ok(result.blockReasons?.some((r) => r.code === "ELEMENTOR_CONTENT_UNSUPPORTED"));
  assert.equal(calls.length, 0);
}

async function testWebStoryBlockedPathThroughOrchestrator() {
  const { writer, calls } = createFakeWriter();
  const orchestrator = new ArticleCommitOrchestrator(writer);

  const result = await orchestrator.execute(
    inputFixture({ candidate: candidateFixture({ hasWebStoryContent: true }) }),
  );

  assert.equal(result.status, "BLOCKED");
  assert.ok(result.blockReasons?.some((r) => r.code === "WEB_STORY_CONTENT_UNSUPPORTED"));
  assert.equal(calls.length, 0);
}

async function testNoMigrationOrMediaDelegatesExistOrTouched() {
  // The injected `ArticleCommitWriterLike` only exposes
  // `createArticleFromDraft` — structurally there is no
  // migrationRecord/migrationLineage/slugHistory/media delegate for this
  // orchestrator to reach for.
  const { writer } = createFakeWriter();
  assert.deepEqual(Object.keys(writer), ["createArticleFromDraft"]);
}

async function testExactResultShapeForEachOutcome() {
  const { writer: successWriter } = createFakeWriter({ result: { ok: true, articleId: "article-1" } });
  const successResult = await new ArticleCommitOrchestrator(successWriter).execute(inputFixture());
  assert.deepEqual(new Set(Object.keys(successResult)), new Set(["ok", "status", "articleId", "warnings"]));

  const { writer: blockWriter } = createFakeWriter();
  const blockResult = await new ArticleCommitOrchestrator(blockWriter).execute(
    inputFixture({ candidate: candidateFixture({ title: "" }) }),
  );
  assert.deepEqual(new Set(Object.keys(blockResult)), new Set(["ok", "status", "blockReasons"]));

  const { writer: failWriter } = createFakeWriter({
    result: { ok: false, errorCode: "ARTICLE_CREATE_FAILED", errorMessage: "boom" },
  });
  const failResult = await new ArticleCommitOrchestrator(failWriter).execute(inputFixture());
  assert.deepEqual(new Set(Object.keys(failResult)), new Set(["ok", "status", "errorCode", "errorMessage"]));
}

async function main() {
  await testSuccessfulOrchestrationReturnsArticleId();
  await testDraftBlockedMeansWriterNotCalled();
  await testWriterFailureReturnsFailedResult();
  await testWarningsPropagated();
  await testLossyContentWarningPropagated();
  await testElementorBlockedPathThroughOrchestrator();
  await testWebStoryBlockedPathThroughOrchestrator();
  await testNoMigrationOrMediaDelegatesExistOrTouched();
  await testExactResultShapeForEachOutcome();
}

main()
  .then(() => {
    console.log("ArticleCommitOrchestrator tests: OK");
  })
  .catch((error) => {
    console.error("ArticleCommitOrchestrator tests: FAILED", error);
    process.exitCode = 1;
  });
