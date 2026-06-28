import assert from "node:assert/strict";

import {
  BYN_SYMBOL,
  formatPrice,
  normalizeRichTextCurrency,
  normalizeUiCurrencyText,
} from "./format-price";

const GLYPH = "";

// (b) Числовой/структурный путь: вход → `` (регресс не сломан).
assert.equal(
  normalizeUiCurrencyText("Дети — 30 В\nВзрослые — 50 B\nСемейный билет — 80 ₿"),
  `Дети — 30 ${BYN_SYMBOL}\nВзрослые — 50 ${BYN_SYMBOL}\nСемейный билет — 80 ${BYN_SYMBOL}`,
);
assert.equal(normalizeUiCurrencyText("25,00 Br"), `25,00 ${BYN_SYMBOL}`);
assert.equal(normalizeUiCurrencyText(`30 ${GLYPH}`), `30 ${BYN_SYMBOL}`);
assert.equal(formatPrice(15), `15,00 ${BYN_SYMBOL}`);

// (a) Рич-текст: ``/В/₽/руб./BYN → Br.
assert.equal(normalizeRichTextCurrency(`30 ${GLYPH}`), "30 Br");
assert.equal(normalizeRichTextCurrency("30 В"), "30 Br");
assert.equal(normalizeRichTextCurrency("30 ₽"), "30 Br");
assert.equal(normalizeRichTextCurrency("30 руб."), "30 Br");
assert.equal(normalizeRichTextCurrency("30 BYN"), "30 Br");
assert.equal(
  normalizeRichTextCurrency(`Дети — 30 В\nВзрослые — 50 ${GLYPH}\nСемейный — 80 BYN`),
  "Дети — 30 Br\nВзрослые — 50 Br\nСемейный — 80 Br",
);

// (c) Идемпотентность рич-текст-нормализатора: Br → Br.
assert.equal(normalizeRichTextCurrency("30 Br"), "30 Br");
assert.equal(
  normalizeRichTextCurrency(normalizeRichTextCurrency(`30 ${GLYPH}`)),
  "30 Br",
);

// (d) Старые данные → канон Br.
assert.equal(normalizeRichTextCurrency("30 В"), "30 Br");
assert.equal(normalizeRichTextCurrency("25,00 Br"), "25,00 Br");

// Пустые значения.
assert.equal(normalizeRichTextCurrency(null), "");
assert.equal(normalizeRichTextCurrency(undefined), "");

console.log("format-price.test.ts: OK");
