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

function testElementorBlocked() {
  const result = buildArticleCreateDraft({
    candidate: candidateFixture({ hasElementorContent: true }),
    context: contextFixture(),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.reasons.some((r) => r.code === "ELEMENTOR_CONTENT_UNSUPPORTED"));
}

function testWebStoryBlocked() {
  const result = buildArticleCreateDraft({
    candidate: candidateFixture({ hasWebStoryContent: true }),
    context: contextFixture(),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.reasons.some((r) => r.code === "WEB_STORY_CONTENT_UNSUPPORTED"));
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
  assert.equal(result.draft.contentJson.blocks[0].type, "text");
}

function testHtmlStrippedToPlainText() {
  const result = buildArticleCreateDraft({
    candidate: candidateFixture({ content: "<p>Some <b>rich</b>   content about  kids.</p>" }),
    context: contextFixture(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const block = result.draft.contentJson.blocks[0];
  assert.equal(block.type, "text");
  if (block.type !== "text") return;
  assert.equal(block.text, "Some rich content about kids.");
  assert.ok(!block.text.includes("<"));
}

function testContentConvertedLossyWarningPresent() {
  const result = buildArticleCreateDraft({ candidate: candidateFixture(), context: contextFixture() });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].code, "CONTENT_CONVERTED_LOSSY");
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
  testElementorBlocked();
  testWebStoryBlocked();
  testSeoFieldsCopied();
  testSlugCopiedRawNoGeneration();
  testContentJsonIsVersionOneTextBlock();
  testHtmlStrippedToPlainText();
  testContentConvertedLossyWarningPresent();
  testMissingContentBlocked();
  testAuthorContextCopiedWhenProvided();
  testNoMediaCategoryTagsGeoSlugHistoryFieldsWritten();
}

main();
console.log("buildArticleCreateDraft tests: OK");
