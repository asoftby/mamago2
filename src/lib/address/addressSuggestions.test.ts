/**
 * Чистая логика подсказок адреса. Запуск: npx tsx src/lib/address/addressSuggestions.test.ts
 */
import assert from "node:assert/strict";
import {
  ADDRESS_SUGGEST_MAX_ITEMS,
  SUGGEST_LIST_MAX_HEIGHT,
  SUGGEST_LIST_MIN_HEIGHT,
  computeSuggestListMaxHeight,
  mapSuggestions,
  moveActiveIndex,
  shouldAdoptExternalValue,
  shouldQuerySuggestions,
  splitHighlight,
} from "./addressSuggestions";

// ── splitHighlight: подсветка совпадений ─────────────────────────────────────
assert.deepEqual(splitHighlight("Притыцкого 12", [{ startOffset: 0, endOffset: 5 }]), [
  { text: "Приты", match: true },
  { text: "цкого 12", match: false },
]);
assert.deepEqual(splitHighlight("ул. Притыцкого", [{ startOffset: 4, endOffset: 9 }, { startOffset: 0, endOffset: 2 }]), [
  { text: "ул", match: true },
  { text: ". ", match: false },
  { text: "Приты", match: true },
  { text: "цкого", match: false },
], "ranges are sorted");
assert.deepEqual(splitHighlight("Минск", [{ startOffset: 0, endOffset: 3 }, { startOffset: 2, endOffset: 5 }]), [
  { text: "Минск", match: true },
], "overlapping ranges merge");
assert.deepEqual(splitHighlight("Минск", null), [{ text: "Минск", match: false }]);
assert.deepEqual(splitHighlight("Минск", [{ startOffset: 10, endOffset: 20 }]), [{ text: "Минск", match: false }], "out-of-range ignored");
assert.deepEqual(splitHighlight("Минск", [{ startOffset: 3, endOffset: 3 }]), [{ text: "Минск", match: false }], "empty range ignored");
assert.deepEqual(splitHighlight("", [{ startOffset: 0, endOffset: 1 }]), []);
assert.deepEqual(
  splitHighlight("Минск", [{ startOffset: null, endOffset: 2 }]).map((s) => s.text).join(""),
  "Минск",
  "segments always reassemble to the original text",
);

// ── mapSuggestions ───────────────────────────────────────────────────────────
const mapped = mapSuggestions([
  { placeId: "p1", mainText: { text: "Притыцкого 12", matches: [{ startOffset: 0, endOffset: 4 }] }, secondaryText: { text: "Минск, Беларусь" }, text: { text: "Притыцкого 12, Минск" } },
  { placeId: "p1", mainText: { text: "дубль" } },
  { placeId: "", mainText: { text: "без id" } },
  null,
  undefined,
  { placeId: "p2", text: { text: "Только общий текст", matches: [{ startOffset: 0, endOffset: 4 }] } },
  { placeId: "p3", mainText: { text: "  " }, text: { text: "" } },
]);
assert.deepEqual(mapped.map((m) => m.id), ["p1", "p2"], "no duplicates, no items without id/text");
assert.equal(mapped[0].secondaryText, "Минск, Беларусь");
assert.deepEqual(mapped[0].mainSegments[0], { text: "Прит", match: true }, "main text matches are used for highlighting");
assert.equal(mapped[1].mainText, "Только общий текст", "falls back to full text");
assert.deepEqual(mapped[1].mainSegments[0], { text: "Толь", match: true }, "full-text matches used for the fallback");

const many = Array.from({ length: 20 }, (_, i) => ({ placeId: `id${i}`, mainText: { text: `Адрес ${i}` } }));
assert.equal(mapSuggestions(many).length, ADDRESS_SUGGEST_MAX_ITEMS, "list is bounded");
assert.equal(mapSuggestions(many, 3).length, 3);

// ── shouldQuerySuggestions: не ходим в Google на 0-1 символ ──────────────────
assert.equal(shouldQuerySuggestions(""), false);
assert.equal(shouldQuerySuggestions(" а "), false);
assert.equal(shouldQuerySuggestions("ул"), true);

// ── moveActiveIndex: клавиатурная навигация ──────────────────────────────────
assert.equal(moveActiveIndex(-1, "down", 3), 0);
assert.equal(moveActiveIndex(0, "down", 3), 1);
assert.equal(moveActiveIndex(2, "down", 3), 0, "wraps to the start");
assert.equal(moveActiveIndex(-1, "up", 3), 2, "up from nothing goes to the last item");
assert.equal(moveActiveIndex(0, "up", 3), 2);
assert.equal(moveActiveIndex(2, "up", 3), 1);
assert.equal(moveActiveIndex(1, "down", 0), -1, "empty list has no active item");

// ── shouldAdoptExternalValue: эхо от родителя не затирает ввод ───────────────
assert.equal(shouldAdoptExternalValue("ул", "ул "), false, "trailing space typed by the user is kept");
assert.equal(shouldAdoptExternalValue(undefined, ""), false);
assert.equal(shouldAdoptExternalValue("Минск, Притыцкого 12", "Прит"), true, "real external change is adopted");
assert.equal(shouldAdoptExternalValue("", "Прит"), true, "form reset clears the field");

// ── computeSuggestListMaxHeight: список под открытой клавиатурой ─────────────
assert.equal(computeSuggestListMaxHeight({ visibleBottom: 844, panelTop: 120 }), SUGGEST_LIST_MAX_HEIGHT, "plenty of room: capped at the max");
assert.equal(computeSuggestListMaxHeight({ visibleBottom: 400, panelTop: 120 }), 244, "keyboard open: fits above the keyboard (400-120-36)");
assert.equal(computeSuggestListMaxHeight({ visibleBottom: 300, panelTop: 200 }), SUGGEST_LIST_MIN_HEIGHT, "tiny viewport: never below the minimum (page scrolls instead)");
assert.equal(computeSuggestListMaxHeight({ visibleBottom: 300, panelTop: 500 }), SUGGEST_LIST_MIN_HEIGHT, "panel below the visible area: minimum");
assert.equal(computeSuggestListMaxHeight({ visibleBottom: Number.NaN, panelTop: 0 }), SUGGEST_LIST_MAX_HEIGHT, "garbage input falls back to the max");
assert.ok(SUGGEST_LIST_MIN_HEIGHT >= 2 * 44, "minimum shows at least two 44px rows");

console.log("addressSuggestions.test.ts: OK");
