import assert from "node:assert/strict";

import { buildArticleCreateDraft } from "./buildArticleCreateDraft";
import type { ArticleCommitContext, NormalizedArticleCandidate } from "./buildArticleCreateDraft";

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

function testSuccessfulMinimalDraft() {
  const result = buildArticleCreateDraft({ candidate: candidateFixture(), context: contextFixture() });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.title, "Hello Article");
  assert.equal(result.draft.status, "PENDING");
  assert.equal(result.draft.authorUserId, null);
  assert.equal(result.draft.authorLabel, null);
}

function testMissingTitleBlocked() {
  const result = buildArticleCreateDraft({
    candidate: candidateFixture({ title: "" }),
    context: contextFixture(),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.reasons.some((r) => r.code === "MISSING_TITLE"));
}

function testBlankTitleBlocked() {
  const result = buildArticleCreateDraft({
    candidate: candidateFixture({ title: "   " }),
    context: contextFixture(),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.reasons.some((r) => r.code === "MISSING_TITLE"));
}

function testElementorWithUsablePostContentSucceeds() {
  const result = buildArticleCreateDraft({
    candidate: candidateFixture({ hasElementorContent: true }),
    context: contextFixture(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.title, "Hello Article");
}

function testWebStoryWithUsableContentSucceeds() {
  const result = buildArticleCreateDraft({
    candidate: candidateFixture({ hasWebStoryContent: true }),
    context: contextFixture(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.title, "Hello Article");
}

function testRealElementorWithoutUsableContentBlocked() {
  const result = buildArticleCreateDraft({
    candidate: candidateFixture({ hasElementorContent: true, content: "<p></p>" }),
    context: contextFixture(),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.reasons.some((r) => r.code === "ELEMENTOR_CONTENT_NOT_REPRESENTABLE"));
  assert.equal(result.reasons.some((r) => r.code === "MISSING_CONTENT"), false);
}

function testSeoFieldsCopied() {
  const result = buildArticleCreateDraft({ candidate: candidateFixture(), context: contextFixture() });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.seoTitle, "SEO Title");
  assert.equal(result.draft.seoDescription, "SEO description");
  assert.equal(result.draft.seoCanonicalUrl, "https://example.com/hello-article");
  assert.equal(result.draft.seoRobots, "index, follow");
  assert.equal(result.draft.seoOgTitle, "OG Title");
  assert.equal(result.draft.seoOgDescription, "OG description");
}

function testSlugCopiedRawNoGeneration() {
  const result = buildArticleCreateDraft({
    candidate: candidateFixture({ slug: "already-set-slug" }),
    context: contextFixture(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.slug, "already-set-slug");

  const withEmptySlug = buildArticleCreateDraft({
    candidate: candidateFixture({ slug: "" }),
    context: contextFixture(),
  });
  assert.equal(withEmptySlug.ok, true);
  if (!withEmptySlug.ok) return;
  assert.equal(withEmptySlug.draft.slug, null, "an empty WP slug must never trigger slug generation, just null");
}

function testContentJsonIsVersionOneTextBlock() {
  const result = buildArticleCreateDraft({ candidate: candidateFixture(), context: contextFixture() });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.contentJson.version, 1);
  assert.equal(result.draft.contentJson.blocks.length, 1);
  assert.equal(result.draft.contentJson.blocks[0].type, "intro");
}

function testHtmlNormalizedToArticleBlocks() {
  const result = buildArticleCreateDraft({
    candidate: candidateFixture({ content: "<h2>Цены:</h2><p>10 руб.</p><p>20 руб.</p><p>Some <b>rich</b> content.</p>" }),
    context: contextFixture(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.draft.contentJson.blocks.map((block) => block.type),
    ["heading", "text", "intro"],
  );
  const listBlock = result.draft.contentJson.blocks[1];
  assert.equal(listBlock.type, "text");
  if (listBlock.type !== "text") return;
  assert.equal(listBlock.text, "- 10 руб.\n- 20 руб.");
}

function testContentNormalizationWarningPresent() {
  const result = buildArticleCreateDraft({ candidate: candidateFixture(), context: contextFixture() });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].code, "CONTENT_NORMALIZED_WITH_LIMITATIONS");
}

function testContentNormalizationDownconvertWarningPresent() {
  const result = buildArticleCreateDraft({
    candidate: candidateFixture({ content: "<p>Цены:</p><p>10 руб.</p><p>20 руб.</p>" }),
    context: contextFixture(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.warnings.some((warning) => warning.code === "UNSUPPORTED_ARTICLE_BLOCK_DOWNCONVERTED"));
}

function testMissingContentBlocked() {
  const result = buildArticleCreateDraft({
    candidate: candidateFixture({ content: "<p></p>" }),
    context: contextFixture(),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.reasons.some((r) => r.code === "MISSING_CONTENT"));
}

function testAuthorContextCopiedWhenProvided() {
  const result = buildArticleCreateDraft({
    candidate: candidateFixture(),
    context: contextFixture({ authorUserId: "user-1", authorLabel: "Jane Doe" }),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.authorUserId, "user-1");
  assert.equal(result.draft.authorLabel, "Jane Doe");
}

function testNoMediaCategoryTagsGeoSlugHistoryFieldsWritten() {
  const result = buildArticleCreateDraft({ candidate: candidateFixture(), context: contextFixture() });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    new Set(Object.keys(result.draft)),
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

  for (const forbiddenKey of [
    "coverImageId",
    "seoImageId",
    "heroImage",
    "categoryId",
    "tags",
    "relatedPlaceId",
    "cityId",
    "geoScope",
    "cityContext",
    "slugHistory",
    "modifiedAt",
    "seoFocusKeyword",
  ]) {
    assert.ok(!(forbiddenKey in result.draft), `draft must never include "${forbiddenKey}"`);
  }
}

function main() {
  testSuccessfulMinimalDraft();
  testMissingTitleBlocked();
  testBlankTitleBlocked();
  testElementorWithUsablePostContentSucceeds();
  testWebStoryWithUsableContentSucceeds();
  testRealElementorWithoutUsableContentBlocked();
  testSeoFieldsCopied();
  testSlugCopiedRawNoGeneration();
  testContentJsonIsVersionOneTextBlock();
  testHtmlNormalizedToArticleBlocks();
  testContentNormalizationWarningPresent();
  testContentNormalizationDownconvertWarningPresent();
  testMissingContentBlocked();
  testAuthorContextCopiedWhenProvided();
  testNoMediaCategoryTagsGeoSlugHistoryFieldsWritten();
}

main();
console.log("buildArticleCreateDraft tests: OK");
