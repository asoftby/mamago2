import assert from "node:assert/strict";

import { formatEventDate, itemStateLabel, moveItem, parseQuickLine, wishlistErrorMessage } from "./wishlistView";

assert.deepEqual(parseQuickLine("Лего Сити пожарная станция https://21vek.by/toys/lego"), {
  title: "Лего Сити пожарная станция",
  url: "https://21vek.by/toys/lego",
});
assert.deepEqual(parseQuickLine("Книга про динозавров"), { title: "Книга про динозавров", url: null });
assert.deepEqual(parseQuickLine("https://www.ozon.ru/product/1/"), { title: "ozon.ru", url: "https://www.ozon.ru/product/1/" });
assert.equal(parseQuickLine("Самокат (https://example.com/a).").url, "https://example.com/a");
assert.equal(parseQuickLine("  ").title, "");

assert.equal(itemStateLabel("FREE", 0, 1), null);
assert.equal(itemStateLabel("PARTIAL", 1, 2), "Занято 1 из 2");
assert.equal(itemStateLabel("RESERVED", 1, 1), "Забронирован");
assert.equal(itemStateLabel("PURCHASED", 1, 1), "Куплен");

assert.deepEqual(moveItem([1, 2, 3], 0, 2), [2, 3, 1]);
assert.deepEqual(moveItem([1, 2, 3], 1, 1), [1, 2, 3]);
assert.deepEqual(moveItem([1, 2, 3], 5, 0), [1, 2, 3]);

assert.equal(formatEventDate(null), null);
assert.match(formatEventDate("2026-12-05") ?? "", /5 декабря/);
assert.equal(wishlistErrorMessage("nope"), "Не получилось. Попробуйте ещё раз.");
assert.equal(wishlistErrorMessage("archived"), "Список в архиве. Верните его из архива, чтобы редактировать.");

console.log("wishlistView ok");
