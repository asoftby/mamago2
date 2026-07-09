import assert from "node:assert/strict";

import { normalizeArticle, type NormalizedArticleCandidate } from "./normalizeArticle";
import type { WordPressArticleBundle, WordPressPostRow, WordPressTermRow } from "./types";

function payloadOf(record: ReturnType<typeof normalizeArticle>): NormalizedArticleCandidate {
  return record.normalizedPayload as NormalizedArticleCandidate;
}

const basePost: WordPressPostRow = {
  ID: 201,
  post_author: 5,
  post_date: "2026-01-01 00:00:00",
  post_content: "<p>Hello world</p>",
  post_title: "Hello Article",
  post_excerpt: "An article excerpt",
  post_status: "publish",
  post_name: "hello-article",
  post_modified: "2026-01-02 00:00:00",
  post_parent: 0,
  guid: "https://example.com/?p=201",
  post_type: "post",
  post_mime_type: "",
};

const articleTerms: WordPressTermRow[] = [
  { post_id: 201, term_id: 10, name: "News", slug: "news", taxonomy: "category" },
  { post_id: 201, term_id: 11, name: "Kids", slug: "kids", taxonomy: "post_tag" },
];

function buildBundle(overrides: Partial<WordPressArticleBundle> = {}): WordPressArticleBundle {
  return {
    post: basePost,
    postMeta: {
      _thumbnail_id: ["555"],
    },
    terms: articleTerms,
    ...overrides,
  };
}

function testOrdinaryArticle() {
  const record = normalizeArticle(buildBundle());
  const payload = payloadOf(record);

  assert.equal(record.sourceRecordKey, "wordpress-db:post:201");
  assert.equal(record.sourceEntityType, "wordpress-db:post");
  assert.equal(record.targetTypeHint, "ARTICLE");

  assert.equal(payload.title, "Hello Article");
  assert.equal(payload.slug, "hello-article");
  assert.equal(payload.content, "<p>Hello world</p>");
  assert.equal(payload.excerpt, "An article excerpt");
  assert.equal(payload.status, "publish");
  assert.equal(payload.publishedAt, "2026-01-01 00:00:00");
  assert.equal(payload.modifiedAt, "2026-01-02 00:00:00");

  assert.deepEqual(payload.sourceTerms, [
    { termId: 10, taxonomy: "category", name: "News", slug: "news" },
    { termId: 11, taxonomy: "post_tag", name: "Kids", slug: "kids" },
  ]);
  assert.deepEqual(record.relationRefs, ["term:category:news", "term:post_tag:kids"]);

  assert.equal(payload.hasElementorContent, false);
  assert.equal(payload.hasWebStoryContent, false);
}

function testRankMathSeo() {
  const record = normalizeArticle(
    buildBundle({
      postMeta: {
        _thumbnail_id: ["555"],
        rank_math_title: ["SEO Title"],
        rank_math_description: ["SEO description text"],
        rank_math_focus_keyword: ["kids activities"],
        rank_math_canonical_url: ["https://example.com/hello-article"],
        rank_math_robots: ['a:1:{i:0;s:5:"index";}'],
        rank_math_facebook_title: ["OG Title"],
        rank_math_facebook_description: ["OG description text"],
      },
    }),
  );
  const payload = payloadOf(record);

  assert.deepEqual(payload.seo, {
    title: "SEO Title",
    description: "SEO description text",
    focusKeyword: "kids activities",
    canonicalUrl: "https://example.com/hello-article",
    robots: 'a:1:{i:0;s:5:"index";}',
    ogTitle: "OG Title",
    ogDescription: "OG description text",
  });
}

function testMultipleOldSlugsPreserved() {
  const record = normalizeArticle(
    buildBundle({
      postMeta: {
        _thumbnail_id: ["555"],
        _wp_old_slug: ["old-slug-one", "old-slug-two", "old-slug-three"],
      },
    }),
  );
  const payload = payloadOf(record);
  assert.deepEqual(payload.oldSlugs, ["old-slug-one", "old-slug-two", "old-slug-three"]);
}

function testFeaturedImage() {
  const record = normalizeArticle(buildBundle({ postMeta: { _thumbnail_id: ["555"] } }));
  const payload = payloadOf(record);

  assert.equal(payload.featuredImageAttachmentId, 555);
  assert.deepEqual(record.mediaRefs, ["555"]);
  assert.ok(!record.warnings?.some((warning) => warning.code === "ARTICLE_MISSING_FEATURED_IMAGE"));
}

function testInlineImageIds() {
  const record = normalizeArticle(
    buildBundle({
      post: {
        ...basePost,
        post_content:
          '<p>Intro</p><img class="wp-image-701 aligncenter" src="a.jpg" />' +
          '<p>More</p><img class="size-full wp-image-702" src="b.jpg" />' +
          '<img class="wp-image-701" src="a-dup.jpg" />',
      },
      postMeta: { _thumbnail_id: ["555"] },
    }),
  );
  const payload = payloadOf(record);

  assert.deepEqual(payload.inlineImageAttachmentIds, [701, 702]);
  assert.deepEqual(record.mediaRefs, ["555", "701", "702"]);
}

function testElementorContentFlaggedNotParsed() {
  const record = normalizeArticle(
    buildBundle({
      postMeta: {
        _thumbnail_id: ["555"],
        _elementor_data: ['[{"id":"abc123","elType":"section"}]'],
        _elementor_template_type: ["wp-post"],
      },
    }),
  );
  const payload = payloadOf(record);

  assert.equal(payload.hasElementorContent, true);
  const warning = record.warnings?.find((w) => w.code === "ARTICLE_ELEMENTOR_CONTENT");
  assert.ok(warning);
  // Raw Elementor JSON is passed through untouched, never parsed into structured fields.
  assert.deepEqual(payload.rawMeta._elementor_data, ['[{"id":"abc123","elType":"section"}]']);
}

function testWebStoryFlaggedNotParsed() {
  const record = normalizeArticle(
    buildBundle({
      postMeta: {
        _thumbnail_id: ["555"],
        "wp-story-image": ["801"],
        "wp-story-cycle-image": ["802", "803"],
      },
    }),
  );
  const payload = payloadOf(record);

  assert.equal(payload.hasWebStoryContent, true);
  const warning = record.warnings?.find((w) => w.code === "ARTICLE_WEB_STORY");
  assert.ok(warning);
  // Web Story attachment ids are not lifted into featured/inline image fields.
  assert.equal(payload.featuredImageAttachmentId, 555);
  assert.deepEqual(payload.inlineImageAttachmentIds, []);
}

function testArticleWithoutFeaturedImageWarns() {
  const record = normalizeArticle(buildBundle({ postMeta: {} }));
  const payload = payloadOf(record);

  assert.equal(payload.featuredImageAttachmentId, null);
  const warning = record.warnings?.find((w) => w.code === "ARTICLE_MISSING_FEATURED_IMAGE");
  assert.ok(warning);
  assert.equal(warning?.severity, "WARNING");
  assert.deepEqual(record.mediaRefs, []);
}

function testRepeatedPostmetaPreservedAsArrays() {
  const record = normalizeArticle(
    buildBundle({
      postMeta: {
        _thumbnail_id: ["555"],
        _wp_old_slug: ["slug-a", "slug-b"],
        "wp-story-cycle-image": ["901", "902"],
      },
    }),
  );
  const payload = payloadOf(record);

  assert.deepEqual(payload.oldSlugs, ["slug-a", "slug-b"]);
  assert.deepEqual(payload.rawMeta["wp-story-cycle-image"], ["901", "902"]);
}

function testEmptyFieldsDoNotThrow() {
  const record = normalizeArticle(
    buildBundle({
      post: { ...basePost, post_content: "", post_excerpt: "" },
      postMeta: {},
      terms: [],
    }),
  );
  const payload = payloadOf(record);

  assert.equal(payload.content, "");
  assert.equal(payload.excerpt, "");
  assert.equal(payload.featuredImageAttachmentId, null);
  assert.deepEqual(payload.inlineImageAttachmentIds, []);
  assert.deepEqual(payload.oldSlugs, []);
  assert.deepEqual(payload.sourceTerms, []);
  assert.deepEqual(payload.rawMeta, {});
  assert.deepEqual(record.mediaRefs, []);
  assert.deepEqual(record.relationRefs, []);
  assert.equal(record.warnings?.length, 1);
  assert.equal(record.warnings?.[0]?.code, "ARTICLE_MISSING_FEATURED_IMAGE");
}

function main() {
  testOrdinaryArticle();
  testRankMathSeo();
  testMultipleOldSlugsPreserved();
  testFeaturedImage();
  testInlineImageIds();
  testElementorContentFlaggedNotParsed();
  testWebStoryFlaggedNotParsed();
  testArticleWithoutFeaturedImageWarns();
  testRepeatedPostmetaPreservedAsArrays();
  testEmptyFieldsDoNotThrow();
}

main();
console.log("normalizeArticle tests: OK");
