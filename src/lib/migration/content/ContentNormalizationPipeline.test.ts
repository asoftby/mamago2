import assert from "node:assert/strict";

import {
  normalizeMigrationContent,
  normalizedContentToArticleContentJson,
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
}

main();
console.log("ContentNormalizationPipeline tests: OK");
