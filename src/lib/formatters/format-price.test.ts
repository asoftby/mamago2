import assert from "node:assert/strict";

import {
  BYN_SYMBOL,
  formatPrice,
  normalizeRichTextCurrency,
  normalizeUiCurrencyText,
} from "./format-price";

const GLYPH = "";

// (b) Числовой/структурный путь: вход → `U+E901` (регресс не сломан).
assert.equal(
  normalizeUiCurrencyText("Дети — 30 В\nВзрослые — 50 B\nСемейный билет — 80 ₿"),
  `Дети — 30 ${BYN_SYMBOL}\nВзрослые — 50 ${BYN_SYMBOL}\nСемейный билет — 80 ${BYN_SYMBOL}`,
);
assert.equal(normalizeUiCurrencyText("25,00 Br"), `25,00 ${BYN_SYMBOL}`);
assert.equal(normalizeUiCurrencyText(`30 ${GLYPH}`), `30 ${BYN_SYMBOL}`);
assert.equal(formatPrice(15), `15,00 ${BYN_SYMBOL}`);

// (a) Рич-текст: `U+E901`/В/₽/руб./Br → BYN.
assert.equal(normalizeRichTextCurrency(`30 ${GLYPH}`), "30 BYN");
assert.equal(normalizeRichTextCurrency("30 В"), "30 BYN");
assert.equal(normalizeRichTextCurrency("30 ₽"), "30 BYN");
assert.equal(normalizeRichTextCurrency("30 руб."), "30 BYN");
assert.equal(normalizeRichTextCurrency("30 Br"), "30 BYN");
assert.equal(
  normalizeRichTextCurrency(`Дети — 30 В\nВзрослые — 50 ${GLYPH}\nСемейный — 80 Br`),
  "Дети — 30 BYN\nВзрослые — 50 BYN\nСемейный — 80 BYN",
);

// (c) Идемпотентность рич-текст-нормализатора: BYN → BYN.
assert.equal(normalizeRichTextCurrency("30 BYN"), "30 BYN");
assert.equal(
  normalizeRichTextCurrency(normalizeRichTextCurrency(`30 ${GLYPH}`)),
  "30 BYN",
);

// (d) Старые данные → канон BYN.
assert.equal(normalizeRichTextCurrency("30 В"), "30 BYN");
assert.equal(normalizeRichTextCurrency("25,00 Br"), "25,00 BYN");

// Пустые значения.
assert.equal(normalizeRichTextCurrency(null), "");
assert.equal(normalizeRichTextCurrency(undefined), "");

console.log("format-price.test.ts: OK");
