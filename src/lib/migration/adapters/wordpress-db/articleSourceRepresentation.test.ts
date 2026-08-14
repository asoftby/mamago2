import assert from "node:assert/strict";

import {
  appendMissingStoryImages,
  extractInlineImageAttachmentIdsFromHtml,
  extractStoryAttachmentIds,
  hasMeaningfulElementorMeta,
  hasWebStoryMeta,
  isMeaningfulElementorPayload,
  linearizeArticleSourceHtml,
} from "./articleSourceRepresentation";

function testEmptyElementorPayloadsAreNotMeaningful() {
  assert.equal(isMeaningfulElementorPayload(null), false);
  assert.equal(isMeaningfulElementorPayload(""), false);
  assert.equal(isMeaningfulElementorPayload("   "), false);
  assert.equal(isMeaningfulElementorPayload("[]"), false);
  assert.equal(isMeaningfulElementorPayload("{}"), false);
  assert.equal(isMeaningfulElementorPayload("null"), false);
  assert.equal(isMeaningfulElementorPayload('[{"id":"abc123","elType":"section"}]'), false);
  assert.equal(hasMeaningfulElementorMeta({ _elementor_data: [""] }), false);
  assert.equal(hasMeaningfulElementorMeta({ _elementor_data: ["[]"] }), false);
  assert.equal(hasMeaningfulElementorMeta({ _elementor_template_type: ["wp-post"] }), false);
}

function testRealElementorWidgetIsMeaningful() {
  const payload = JSON.stringify([
    {
      id: "w1",
      elType: "widget",
      widgetType: "text-editor",
      settings: { editor: "<p>Купалье в Минске</p>" },
    },
  ]);
  assert.equal(isMeaningfulElementorPayload(payload), true);
  assert.equal(hasMeaningfulElementorMeta({ _elementor_data: [payload] }), true);
}

function testNonJsonNonEmptyElementorIsMeaningful() {
  assert.equal(isMeaningfulElementorPayload("a:1:{s:7:\"widgets\";a:1:{i:0;s:4:\"text\";}}"), true);
}

function testWebStoryMetaPresence() {
  assert.equal(hasWebStoryMeta({}), false);
  assert.equal(hasWebStoryMeta({ "wp-story-image": [""] }), false);
  assert.equal(hasWebStoryMeta({ "wp-story-image": ["801"] }), true);
  assert.equal(hasWebStoryMeta({ "wp-story-cycle-image": ["802", "803"] }), true);
}

function testLinearizeAmpStoryPreservesOrderAndImages() {
  const raw = `
    <amp-story>
      <amp-analytics>{"x":1}</amp-analytics>
      <amp-story-page>
        <amp-story-grid-layer>
          <h1>Page one</h1>
          <amp-img src="https://example.com/a.jpg" alt="A" class="wp-image-11"></amp-img>
          <p>First text</p>
        </amp-story-grid-layer>
      </amp-story-page>
      <amp-story-page>
        <p>Second text</p>
        <a href="https://mamago.by/x">link</a>
      </amp-story-page>
    </amp-story>
  `;
  const html = linearizeArticleSourceHtml(raw);
  assert.equal(/amp-story/i.test(html), false);
  assert.equal(/amp-analytics/i.test(html), false);
  assert.equal(/amp-img/i.test(html), false);
  assert.match(html, /<img[^>]*class="wp-image-11"/);
  assert.ok(html.indexOf("Page one") < html.indexOf("First text"));
  assert.ok(html.indexOf("First text") < html.indexOf("Second text"));
  assert.match(html, /href="https:\/\/mamago.by\/x"/);
}

function testLinearizeLeavesOrdinaryHtmlUnchangedStructurally() {
  const raw = '<p>Hello</p><img class="wp-image-5" src="https://example.com/5.jpg" />';
  assert.equal(linearizeArticleSourceHtml(raw), raw);
}

function testStoryAttachmentIdExtraction() {
  assert.deepEqual(extractStoryAttachmentIds({ "wp-story-image": ["801"] }), [801]);
  assert.deepEqual(extractStoryAttachmentIds({ "wp-story-cycle-image": ["802", "803"] }), [802, 803]);
  assert.deepEqual(
    extractStoryAttachmentIds({ "wp-story-image": ['{"id": 9001, "url": "https://x"}'] }),
    [9001],
  );
  assert.deepEqual(extractStoryAttachmentIds({ "wp-story-image": ["not-an-id"] }), []);
}

function testAppendMissingStoryImagesDoesNotDuplicate() {
  const html = '<p>Hi</p><img class="wp-image-11" src="https://example.com/a.jpg" />';
  const withExtras = appendMissingStoryImages(html, [11, 22]);
  assert.equal(extractInlineImageAttachmentIdsFromHtml(withExtras).includes(11), true);
  assert.equal(extractInlineImageAttachmentIdsFromHtml(withExtras).includes(22), true);
  assert.equal((withExtras.match(/wp-image-11/g) ?? []).length, 1);
}

function main() {
  testEmptyElementorPayloadsAreNotMeaningful();
  testRealElementorWidgetIsMeaningful();
  testNonJsonNonEmptyElementorIsMeaningful();
  testWebStoryMetaPresence();
  testLinearizeAmpStoryPreservesOrderAndImages();
  testLinearizeLeavesOrdinaryHtmlUnchangedStructurally();
  testStoryAttachmentIdExtraction();
  testAppendMissingStoryImagesDoesNotDuplicate();
}

main();
console.log("articleSourceRepresentation tests: OK");
