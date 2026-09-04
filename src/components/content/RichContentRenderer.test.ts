import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareRichContentHtml,
  sanitizeRichContent,
} from "./RichContentRenderer";

test("preserves supported rich-text formatting used by event descriptions", () => {
  const html =
    '<div><strong>Заголовок</strong></div><div><u>Подчеркнуто</u></div><ul><li>Пункт</li></ul><blockquote>Цитата</blockquote>';

  assert.equal(sanitizeRichContent(html), html);
});

test("converts legacy plain-text event descriptions to safe HTML with line breaks", () => {
  assert.equal(
    prepareRichContentHtml("Первый абзац\nВторая строка\n\nНовый блок"),
    "<p>Первый абзац<br>Вторая строка<br><br>Новый блок</p>",
  );
});

test("escapes markup when legacy content is plain text", () => {
  assert.equal(
    prepareRichContentHtml("2 < 3 & 5 > 4"),
    "<p>2 &lt; 3 &amp; 5 &gt; 4</p>",
  );
});
