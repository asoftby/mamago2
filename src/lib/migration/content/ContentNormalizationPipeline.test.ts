import assert from "node:assert/strict";

import {
  normalizeMigrationContent,
  normalizedContentToArticleContentJson,
  normalizedContentToArticleContentJsonWithMedia,
} from "./ContentNormalizationPipeline";

function textOf(result: ReturnType<typeof normalizeMigrationContent>): string {
  return result.plainText;
}

function testNewlineCleanup() {
  const result = normalizeMigrationContent({
    sourceKind: "csv",
    raw: "Текст\r\n\n\n\nс\t\tпробелами      внутри",
  });

  assert.equal(textOf(result), "Текст\nс пробелами внутри");
}

function testHtmlCleanup() {
  const result = normalizeMigrationContent({
    sourceKind: "wordpress",
    raw: `
      <!-- wp:paragraph -->
      <div id="post-1" class="wp-block-group" style="color:red" data-elementor-id="1">
        <p><span>&nbsp;</span></p>
        <p>Полезный <strong>текст</strong></p>
      </div>
    `,
  });

  assert.equal(textOf(result), "Полезный текст");
  assert.equal(result.blocks.length, 1);
  assert.equal(result.blocks[0].type, "paragraph");
}

function testWhitespaceNormalization() {
  const result = normalizeMigrationContent({
    raw: "Текст   с     пробелами\u200B и&nbsp;nbsp",
  });

  assert.equal(textOf(result), "Текст с пробелами и nbsp");
}

function testHeadingDetection() {
  const result = normalizeMigrationContent({
    raw: "Цены:\n10 руб.\n20 руб.\n\nКонтактная информация:\nInstagram",
  });

  assert.deepEqual(
    result.blocks.map((block) => block.type),
    ["heading", "bulletList", "heading", "heading"],
  );
  assert.deepEqual(result.blocks[0], { type: "heading", level: 2, text: "Цены" });
}

function testBulletDetection() {
  const result = normalizeMigrationContent({
    raw: "- Первый пункт\n- Второй пункт\n1. Шаг один\n2. Шаг два",
  });

  assert.deepEqual(
    result.blocks.map((block) => block.type),
    ["bulletList", "orderedList"],
  );
}

function testLinkCleanup() {
  const result = normalizeMigrationContent({
    raw: `
      <p><a href="javascript:alert(1)">Опасная ссылка</a></p>
      <p><a href="https://mamago.by/post/?utm_source=x&fbclid=y&ok=1">mamaGo</a></p>
      <p><a href="mailto:test@example.com">Email</a></p>
    `,
  });

  assert.ok(!textOf(result).includes("javascript:"));
  assert.ok(!textOf(result).includes("mailto:"));
  assert.ok(!textOf(result).includes("utm_source"));
  assert.ok(!textOf(result).includes("fbclid"));
  assert.ok(textOf(result).includes("https://mamago.by/post/?ok=1"));
}

function testWordPressHtmlSampleConvertsToArticleBlocks() {
  const result = normalizeMigrationContent({
    sourceKind: "wordpress",
    raw: `
      <!-- wp:heading --><h2>Адрес:</h2>
      <!-- /wp:heading --><p>г. Минск, Братская 6А</p>
      <p>Цены:</p><p>10 руб.</p><p>20 руб.</p>
    `,
  });
  const article = normalizedContentToArticleContentJson(result);

  assert.equal(article.contentJson.version, 1);
  assert.deepEqual(
    article.contentJson.blocks.map((block) => block.type),
    ["heading", "intro", "heading", "text"],
  );
  assert.equal(article.contentJson.blocks[0].type, "heading");
  assert.equal(article.contentJson.blocks[0].text, "Адрес");
}

function testElementorHtmlSampleRemovesLayoutNoise() {
  const result = normalizeMigrationContent({
    sourceKind: "wordpress",
    raw: `
      <!-- Elementor -->
      <section class="elementor-section" data-id="abc" style="display:flex">
        <div class="elementor-widget-container"><p>Чистый текст</p></div>
      </section>
    `,
  });

  assert.equal(textOf(result), "Чистый текст");
}

function testGooglePlacesSample() {
  const result = normalizeMigrationContent({
    sourceKind: "google-places",
    raw: "Детский центр · 4,8\n\nОткрыто до 21:00\n\nАдрес:\nБратская 6А",
  });

  assert.ok(textOf(result).includes("Детский центр"));
  assert.ok(result.blocks.some((block) => block.type === "heading" && block.text === "Адрес"));
}

function testCsvSample() {
  const result = normalizeMigrationContent({
    sourceKind: "csv",
    raw: "Описание;  Цена:  \n\n  15 руб.  \n 20 руб. ",
  });

  assert.ok(textOf(result).includes("Описание; Цена"));
  assert.ok(result.blocks.some((block) => block.type === "bulletList"));
}

function testArticleContentJsonHasNoLiteralBackslashN() {
  const result = normalizeMigrationContent({
    sourceKind: "wordpress",
    raw: "<p>Первая строка\\nВторая строка</p>",
  });
  const article = normalizedContentToArticleContentJson(result);

  const textValues = article.contentJson.blocks
    .flatMap((block) => {
      if (block.type === "text" || block.type === "intro" || block.type === "heading") {
        return [block.text];
      }
      // The list-like block shapes are a superset of the current
      // ArticleContentPayload union; treat them leniently in tests.
      const listBlock = block as unknown as { type?: string; items?: string[] };
      if (listBlock.type === "bulletList" || listBlock.type === "orderedList") {
        return listBlock.items ?? [];
      }
      return [];
    })
    .filter((value): value is string => typeof value === "string");

  for (const value of textValues) {
    assert.ok(!value.includes("\\n"), "contentJson text must not contain literal \\n sequences");
  }
}

const GALLERY_SAMPLE_HTML = `
  <p>Intro paragraph.</p>
  <figure class="wp-block-image"><img src="https://mamago.by/a-576x1024.jpg" alt="" class="wp-image-111"/></figure>
  <figure class="wp-block-image"><a href="https://mamago.by/a.jpg"><img src="https://mamago.by/b-576x1024.jpg" alt="" class="wp-image-222"/></a></figure>
  <p>Middle paragraph.</p>
  <figure class="wp-block-image"><img src="https://mamago.by/c-576x1024.jpg" alt="cap" class="wp-image-333"/></figure>
  <p>Final paragraph.</p>
`;

// ---------------------------------------------------------------------------
// preserveImagePositions / Article media replay
// ---------------------------------------------------------------------------

function testDefaultModeStillDropsImageBlocks() {
  const result = normalizeMigrationContent({ sourceKind: "wordpress", raw: GALLERY_SAMPLE_HTML });
  assert.deepEqual(
    result.blocks.map((b) => b.type),
    ["paragraph", "paragraph", "paragraph", "image", "image", "image"],
    "default mode still appends images after all text blocks, unchanged",
  );

  const { contentJson, warnings } = normalizedContentToArticleContentJson(result);
  assert.deepEqual(
    contentJson.blocks.map((b) => b.type),
    ["intro", "text", "text"],
    "default downconversion still drops every image block",
  );
  assert.equal(
    warnings.filter((w) => w.code === "UNSUPPORTED_ARTICLE_BLOCK_DOWNCONVERTED").length,
    3,
    "each dropped image still produces its warning",
  );
}

function testAnchorWrappedImageIsNotDestroyed() {
  // The middle gallery image in GALLERY_SAMPLE_HTML is wrapped in a
  // link-to-self <a> (WordPress's "Media File" link destination) — before
  // the normalizeAnchors() fix this silently destroyed the <img> entirely,
  // in both default and replay mode.
  const result = normalizeMigrationContent({ sourceKind: "wordpress", raw: GALLERY_SAMPLE_HTML });
  const images = result.blocks.filter((b) => b.type === "image");
  assert.equal(images.length, 3, "all three images survive, including the anchor-wrapped one");
}

function testReplayModePreservesImagePositionsAndAttachmentIds() {
  const result = normalizeMigrationContent({
    sourceKind: "wordpress",
    raw: GALLERY_SAMPLE_HTML,
    preserveImagePositions: true,
  });

  assert.deepEqual(
    result.blocks.map((b) => (b.type === "image" ? `image:${b.attachmentId}` : b.type)),
    ["paragraph", "image:111", "image:222", "paragraph", "image:333", "paragraph"],
    "images are interleaved at their original position, each carrying its wp-image-<id>",
  );
}

function testReplayNonImageProjectionMatchesDefault() {
  const defaultResult = normalizeMigrationContent({ sourceKind: "wordpress", raw: GALLERY_SAMPLE_HTML });
  const replayResult = normalizeMigrationContent({
    sourceKind: "wordpress",
    raw: GALLERY_SAMPLE_HTML,
    preserveImagePositions: true,
  });

  const defaultProjection = normalizedContentToArticleContentJson(defaultResult).contentJson.blocks;
  // Passing replay's interleaved blocks through the *default* (resolveImageBlock: null)
  // downconverter is exactly the content-divergence preflight's projection step.
  const replayProjection = normalizedContentToArticleContentJson(replayResult).contentJson.blocks;

  assert.deepEqual(replayProjection, defaultProjection, "non-image projection is identical regardless of interleaving");
}

function testMediaAwareDownconversionResolvesImageBlocks() {
  const result = normalizeMigrationContent({
    sourceKind: "wordpress",
    raw: GALLERY_SAMPLE_HTML,
    preserveImagePositions: true,
  });

  const mediaIdByAttachmentId: Record<number, string> = { 111: "media-a", 222: "media-b", 333: "media-c" };
  const { contentJson, warnings } = normalizedContentToArticleContentJsonWithMedia(result, (block) => {
    const mediaId = block.attachmentId !== undefined ? mediaIdByAttachmentId[block.attachmentId] : undefined;
    return mediaId ? { mediaId, alt: block.alt } : null;
  });

  assert.deepEqual(
    contentJson.blocks.map((b) => b.type),
    ["intro", "image", "image", "text", "image", "text"],
    "resolved image blocks land at their interleaved position in the final contentJson",
  );
  const imageBlocks = contentJson.blocks.filter((b): b is Extract<typeof b, { type: "image" }> => b.type === "image");
  assert.deepEqual(
    imageBlocks.map((b) => b.mediaId),
    ["media-a", "media-b", "media-c"],
    "each image block carries the resolved MediaAsset id, in document order",
  );
  assert.equal(
    warnings.filter((w) => w.code === "UNSUPPORTED_ARTICLE_BLOCK_DOWNCONVERTED").length,
    0,
    "no image was dropped once every attachment resolved",
  );
}

function testMediaAwareDownconversionDropsUnresolvedImageWithSameWarningAsDefault() {
  const result = normalizeMigrationContent({
    sourceKind: "wordpress",
    raw: GALLERY_SAMPLE_HTML,
    preserveImagePositions: true,
  });

  // Only resolve attachment 111 — 222/333 are refused (e.g. outside a
  // replay's explicit allowlist), same as if resolveImageBlock were null.
  const { contentJson, warnings } = normalizedContentToArticleContentJsonWithMedia(result, (block) =>
    block.attachmentId === 111 ? { mediaId: "media-a" } : null,
  );

  assert.deepEqual(
    contentJson.blocks.map((b) => b.type),
    ["intro", "image", "text", "text"],
    "only the resolved image is kept; the other two are dropped exactly like default mode",
  );
  const dropWarnings = warnings.filter((w) => w.code === "UNSUPPORTED_ARTICLE_BLOCK_DOWNCONVERTED");
  assert.equal(dropWarnings.length, 2, "one drop warning per unresolved image");
}

function testDuplicateAttachmentReferencesPreserveEachOccurrence() {
  const html = `
    <p>Before.</p>
    <img src="https://mamago.by/x-thumb.jpg" alt="" class="wp-image-99"/>
    <p>Between.</p>
    <img src="https://mamago.by/x-thumb.jpg" alt="" class="wp-image-99"/>
    <p>After.</p>
  `;
  const result = normalizeMigrationContent({ sourceKind: "wordpress", raw: html, preserveImagePositions: true });
  const images = result.blocks.filter((b) => b.type === "image");
  assert.equal(images.length, 2, "both occurrences of the same attachment id are kept as separate image blocks");
  assert.deepEqual(images.map((b) => b.attachmentId), [99, 99]);

  const { contentJson } = normalizedContentToArticleContentJsonWithMedia(result, () => ({ mediaId: "shared-media-id" }));
  const imageBlocks = contentJson.blocks.filter((b): b is Extract<typeof b, { type: "image" }> => b.type === "image");
  assert.equal(imageBlocks.length, 2, "both occurrences reach contentJson as distinct blocks");
  assert.ok(
    imageBlocks.every((b) => b.mediaId === "shared-media-id"),
    "both occurrences reference the same single resolved MediaAsset id — the pipeline never creates a second one",
  );
}

function main() {
  testNewlineCleanup();
  testHtmlCleanup();
  testWhitespaceNormalization();
  testHeadingDetection();
  testBulletDetection();
  testLinkCleanup();
  testWordPressHtmlSampleConvertsToArticleBlocks();
  testElementorHtmlSampleRemovesLayoutNoise();
  testGooglePlacesSample();
  testCsvSample();
  testArticleContentJsonHasNoLiteralBackslashN();
  testDefaultModeStillDropsImageBlocks();
  testAnchorWrappedImageIsNotDestroyed();
  testReplayModePreservesImagePositionsAndAttachmentIds();
  testReplayNonImageProjectionMatchesDefault();
  testMediaAwareDownconversionResolvesImageBlocks();
  testMediaAwareDownconversionDropsUnresolvedImageWithSameWarningAsDefault();
  testDuplicateAttachmentReferencesPreserveEachOccurrence();
}

main();
console.log("ContentNormalizationPipeline tests: OK");
