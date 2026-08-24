import assert from "node:assert/strict";
import test from "node:test";
import { parseTariffCurrencyAmounts } from "./preview-publication-price-backfill";

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
