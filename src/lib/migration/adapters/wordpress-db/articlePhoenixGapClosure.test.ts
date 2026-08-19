/**
 * End-to-end coverage for the Phoenix Article gap: empty/fake Elementor
 * leftover keys, usable post_content fallback, Web Story linearization,
 * mixed markers, and the empty Ivan Kupala fail-closed case.
 *
 * Pre-fix these cases were ARTICLE_BLOCKED via presence-only
 * ELEMENTOR_CONTENT_UNSUPPORTED / WEB_STORY_CONTENT_UNSUPPORTED.
 */
import assert from "node:assert/strict";

import { buildArticleCreateDraft } from "../../commit/article/buildArticleCreateDraft";
import { hashArticleBundle } from "./canonicalSourceHash";
import { normalizeArticle, type NormalizedArticleCandidate } from "./normalizeArticle";
import type { WordPressArticleBundle, WordPressPostRow } from "./types";

const REAL_ELEMENTOR_WIDGET = JSON.stringify([
  {
    id: "w1",
    elType: "widget",
    widgetType: "text-editor",
    settings: { editor: "<p>Наносы Новоселье</p>" },
  },
]);

function post(overrides: Partial<WordPressPostRow> = {}): WordPressPostRow {
  return {
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
    ...overrides,
  };
}

function bundle(overrides: Partial<WordPressArticleBundle> = {}): WordPressArticleBundle {
  return {
    post: post(),
    postMeta: { _thumbnail_id: ["555"] },
    terms: [],
    ...overrides,
  };
}

function draftOf(source: WordPressArticleBundle) {
  const record = normalizeArticle(source);
  const candidate = record.normalizedPayload as NormalizedArticleCandidate;
  return { record, candidate, draft: buildArticleCreateDraft({ candidate, context: {} }) };
}

function testEmptyElementorDataPlusNormalPostContent() {
  const { candidate, draft } = draftOf(
    bundle({ postMeta: { _thumbnail_id: ["555"], _elementor_data: [""] } }),
  );
  assert.equal(candidate.hasElementorContent, false);
  assert.equal(draft.ok, true);
  if (!draft.ok) return;
  assert.equal(draft.draft.contentJson.blocks.length > 0, true);
}

function testTemplateTypeOnlyPlusPostContent() {
  const { candidate, draft } = draftOf(
    bundle({
      postMeta: { _thumbnail_id: ["555"], _elementor_template_type: ["wp-post"], _elementor_data: ["[]"] },
    }),
  );
  assert.equal(candidate.hasElementorContent, false);
  assert.equal(draft.ok, true);
}

function testRealElementorPlusUsablePostContent() {
  const { candidate, draft } = draftOf(
    bundle({
      post: post({
        ID: 251,
        post_name: "nanosy-novosele",
        post_content: "<h2>Наносы</h2><p>Мы провели выходные в деревне.</p>",
      }),
      postMeta: { _thumbnail_id: ["9527"], _elementor_data: [REAL_ELEMENTOR_WIDGET] },
    }),
  );
  assert.equal(candidate.hasElementorContent, true);
  assert.equal(draft.ok, true);
  if (!draft.ok) return;
  const text = draft.draft.contentJson.blocks
    .map((block) => ("text" in block ? block.text : ""))
    .join(" ");
  assert.match(text, /деревне/);
}

function testWebStoryTextAndFeaturedImage() {
  const { record, candidate, draft } = draftOf(
    bundle({
      post: post({
        post_content:
          "<amp-story><amp-story-page><h1>Cover</h1><p>Story body text about a trip.</p></amp-story-page></amp-story>",
      }),
      postMeta: { _thumbnail_id: ["900"], "wp-story-image": ["900"] },
    }),
  );
  assert.equal(candidate.hasWebStoryContent, true);
  assert.equal(candidate.featuredImageAttachmentId, 900);
  assert.equal(draft.ok, true);
  if (!draft.ok) return;
  const text = draft.draft.contentJson.blocks
    .map((block) => ("text" in block ? block.text : ""))
    .join(" ");
  assert.match(text, /Story body text/);
  assert.ok(record.mediaRefs);
  assert.equal(record.mediaRefs[0], "900");
}

function testWebStoryInlineImages() {
  const { candidate, draft } = draftOf(
    bundle({
      post: post({
        post_content:
          '<amp-story><amp-story-page><amp-img class="wp-image-11" src="https://example.com/11.jpg"></amp-img><p>One</p></amp-story-page>' +
          '<amp-story-page><amp-img class="wp-image-22" src="https://example.com/22.jpg"></amp-img><p>Two</p></amp-story-page></amp-story>',
      }),
      postMeta: { _thumbnail_id: ["11"], "wp-story-image": ["11"], "wp-story-cycle-image": ["22", "33"] },
    }),
  );
  assert.deepEqual(candidate.inlineImageAttachmentIds, [11, 22, 33]);
  assert.equal((candidate.content.match(/wp-image-11/g) ?? []).length, 1);
  assert.equal(draft.ok, true);
}

function testMixedWebStoryAndElementorMarkers() {
  const { candidate, draft } = draftOf(
    bundle({
      post: post({
        post_content: "<amp-story><amp-story-page><p>Mixed story with leftover Elementor keys.</p></amp-story-page></amp-story>",
      }),
      postMeta: {
        _thumbnail_id: ["1"],
        _elementor_data: [""],
        _elementor_template_type: ["wp-post"],
        "wp-story-image": ["801"],
      },
    }),
  );
  assert.equal(candidate.hasElementorContent, false);
  assert.equal(candidate.hasWebStoryContent, true);
  assert.equal(draft.ok, true);
}

function testMalformedElementorPayloadIsSemanticPresence() {
  const { candidate, draft } = draftOf(
    bundle({
      postMeta: { _thumbnail_id: ["555"], _elementor_data: ["a:1:{s:7:\"widgets\";a:1:{i:0;s:4:\"text\";}}"] },
    }),
  );
  assert.equal(candidate.hasElementorContent, true);
  assert.equal(draft.ok, true);
}

function testEmptyUnusableArticleFailClosed() {
  const { candidate, draft } = draftOf(
    bundle({
      post: post({
        ID: 46472,
        post_name: "ivan-kupala-2025-ili-gde-otmetit-kupale-v-minske",
        post_title: "Иван Купала 2025 или где отметить Купалье в Минске.",
        post_content: "",
        post_excerpt: "",
      }),
      postMeta: { _thumbnail_id: ["46489"], _elementor_data: [""] },
    }),
  );
  assert.equal(candidate.hasElementorContent, false);
  assert.equal(candidate.hasWebStoryContent, false);
  assert.equal(draft.ok, false);
  if (draft.ok) return;
  assert.ok(draft.reasons.some((reason) => reason.code === "MISSING_CONTENT"));
}

function testIdempotentHashAndDraft() {
  const source = bundle({
    post: post({
      post_content:
        '<amp-story><amp-story-page><p>Same story</p><amp-img class="wp-image-11" src="https://example.com/11.jpg"></amp-img></amp-story-page></amp-story>',
    }),
    postMeta: { _thumbnail_id: ["11"], "wp-story-image": ["11"], _elementor_data: ["[]"] },
  });
  const first = draftOf(source);
  const second = draftOf(source);
  assert.equal(hashArticleBundle(source), hashArticleBundle(source));
  assert.equal(first.draft.ok, true);
  assert.equal(second.draft.ok, true);
  if (!first.draft.ok || !second.draft.ok) return;
  assert.deepEqual(first.draft.draft.contentJson, second.draft.draft.contentJson);
  assert.deepEqual(first.candidate.inlineImageAttachmentIds, second.candidate.inlineImageAttachmentIds);
}

function main() {
  testEmptyElementorDataPlusNormalPostContent();
  testTemplateTypeOnlyPlusPostContent();
  testRealElementorPlusUsablePostContent();
  testWebStoryTextAndFeaturedImage();
  testWebStoryInlineImages();
  testMixedWebStoryAndElementorMarkers();
  testMalformedElementorPayloadIsSemanticPresence();
  testEmptyUnusableArticleFailClosed();
  testIdempotentHashAndDraft();
}

main();
console.log("articlePhoenixGapClosure tests: OK");
