import assert from "node:assert/strict";
import test from "node:test";
import { parseDeterministicLegacyPriceText, parseTariffCurrencyAmounts } from "./preview-publication-price-backfill";

test("recovers a range only from multiple currency-qualified tariff amounts", () => {
  assert.deepEqual(
    parseTariffCurrencyAmounts("Пн–Чт — 610 руб. Пт–Вс — 670 руб."),
    { mode: "RANGE", min: 610, max: 670, currency: "BYN" },
  );
  assert.equal(parseTariffCurrencyAmounts("до 15 гостей, цена зависит от программы — 610 руб."), null);
  assert.equal(parseTariffCurrencyAmounts("от 20 для детей, семейный тариф по запросу"), null);
  assert.deepEqual(parseTariffCurrencyAmounts("10 посещений — 150 рублей; разовое — 20 рублей"), { mode: "RANGE", min: 20, max: 150, currency: "BYN" });
  assert.deepEqual(parseTariffCurrencyAmounts("Взрослый — 20 руб.; дети до 6 лет бесплатно"), { mode: "RANGE", min: 0, max: 20, currency: "BYN" });
  assert.equal(parseTariffCurrencyAmounts("<p>220 руб. <del>260 руб.</del></p>"), null);
  assert.equal(parseTariffCurrencyAmounts("Стоимость включает: 1098 BYN проживание + 1115 BYN активности"), null);
});

test("applies deterministic legacy text semantics conservatively", () => {
  assert.equal(parseDeterministicLegacyPriceText("Вход бесплатный")?.price.mode, "FREE");
  assert.deepEqual(parseDeterministicLegacyPriceText("от 18 руб./час")?.price, { mode: "FROM", min: 18, max: null, currency: "BYN" });
  assert.deepEqual(parseDeterministicLegacyPriceText("95 руб/чел.")?.price, { mode: "EXACT", min: 95, max: 95, currency: "BYN" });
  assert.deepEqual(parseDeterministicLegacyPriceText("Пакет рассчитан на 3 часа — 500 руб.")?.price, { mode: "EXACT", min: 500, max: 500, currency: "BYN" });
  assert.equal(parseDeterministicLegacyPriceText("Аренда — 100 руб./час")?.price.mode, "EXACT");
  assert.equal(parseDeterministicLegacyPriceText("530 руб/3 часа")?.price.mode, "EXACT");
  assert.equal(parseDeterministicLegacyPriceText("17 р. - 30 мин.")?.price.mode, "EXACT");
  assert.equal(parseDeterministicLegacyPriceText("287 руб./мес.")?.price.mode, "EXACT");
  assert.deepEqual(parseDeterministicLegacyPriceText("Пн — 20 руб.; выходной — 30 руб.")?.price, { mode: "RANGE", min: 20, max: 30, currency: "BYN" });
  assert.deepEqual(parseDeterministicLegacyPriceText("<p>220 руб. <del>260 руб.</del>; пакет на 2 часа</p>"), { price: { mode: "EXACT", min: 220, max: 220, currency: "BYN" }, rule: "TEXT_CURRENT_EXACT_FORMER_MARKUP_IGNORED" });
  assert.equal(parseDeterministicLegacyPriceText("АКЦИЯ: 440 руб. вместо 490 руб. до 31.08.2025"), null);
  assert.equal(parseDeterministicLegacyPriceText("Стоимость включает 100 руб. материалы и 200 руб. работу"), null);
  assert.equal(parseDeterministicLegacyPriceText("https://example.com/prices"), null);
});
