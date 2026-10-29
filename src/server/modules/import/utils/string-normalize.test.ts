import assert from "node:assert/strict";
import { normalizeAddress, normalizeEventTitle } from "./string-normalize";

// Кириллица: `\b` не работал, «ул», «пр-т», «пер» не удалялись.
assert.equal(normalizeAddress("ул. Ленина, 5"), normalizeAddress("Ленина 5"));
assert.equal(normalizeAddress("ул. Ленина, 5"), "ленина 5");
assert.equal(normalizeAddress("пр-т Независимости, 12"), "независимости 12");
assert.equal(normalizeAddress("пр-кт Победителей 3"), "победителей 3");
assert.equal(normalizeAddress("пер. Козлова 3"), "козлова 3");
assert.equal(normalizeAddress("улица Энгельса, 26"), normalizeAddress("ул Энгельса 26"));
// Слова, начинающиеся с «ул»/«пр», целиком не режутся.
assert.equal(normalizeAddress("Улановская 4"), "улановская 4");
assert.equal(normalizeAddress("Притыцкого 156"), "притыцкого 156");
// Этаж и ТЦ/ТРЦ не мешают совпадению.
assert.equal(normalizeAddress("Минск, ул. Бобруйская, 6, 4 этаж"), normalizeAddress("Минск, Бобруйская 6"));
assert.equal(normalizeAddress("ТРЦ Galileo, ул. Бобруйская, 6"), "galileo бобруйская 6");

// Название события: эмодзи, возрастные метки, служебные слова.
assert.equal(normalizeEventTitle("🎭 Спектакль «Теремок» (6+)"), "теремок");
assert.equal(normalizeEventTitle("Теремок 0+"), "теремок");
assert.equal(normalizeEventTitle("Мастер-класс по лепке"), "по лепке");
assert.equal(normalizeEventTitle("Квиз"), "квиз", "пустой результат откатывается к обычной нормализации");
assert.equal(normalizeEventTitle("Премьера: Шоу мыльных пузырей"), "мыльных пузырей");

console.log("string-normalize tests: OK");
