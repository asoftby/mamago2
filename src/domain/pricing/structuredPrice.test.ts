import assert from "node:assert/strict";
import test from "node:test";
import { SharedPriceDataSchema, formatSharedPrice, sharedPriceFromPublication } from "./structuredPrice";

test("adapts every authoritative publication price mode", () => {
  const cases = [
    [{ priceMode: "FREE" as const }, "FREE", "Бесплатно"],
    [{ priceMode: "EXACT" as const, priceFrom: 25 }, "EXACT", "25,00 \uE901"],
    [{ priceMode: "FROM" as const, priceFrom: 25 }, "FROM", "от 25,00 \uE901"],
    [{ priceMode: "RANGE" as const, priceFrom: 25, priceTo: 40 }, "RANGE", "25,00–40,00 \uE901"],
    [{ priceMode: "NONE" as const }, "NONE", null],
    [{ priceMode: "UNKNOWN" as const }, "UNKNOWN", null],
  ] as const;
  for (const [source, mode, label] of cases) {
    const value = sharedPriceFromPublication(source);
    assert.equal(value.mode, mode);
    assert.equal(formatSharedPrice(value), label);
  }
});

test("preserves currency and ordered canonical price items", () => {
  const value = sharedPriceFromPublication({
    currency: "EUR",
    priceItems: {
      items: [
        { id: "adult", label: "Взрослый", price: "30", unit: "EUR" },
        { id: "child", label: "Ребёнок", price: "20", unit: "EUR" },
      ],
      note: " По предварительной записи ",
    },
  });
  assert.equal(value.currency, "EUR");
  assert.deepEqual(value.items.map((item) => item.id), ["adult", "child"]);
  assert.equal(value.note, "По предварительной записи");
  assert.equal(value.mode, "RANGE");
});

test("rejects invalid mode/value combinations", () => {
  assert.throws(() => SharedPriceDataSchema.parse({ mode: "FROM", currency: "BYN", min: 10, max: 20, items: [], note: "" }));
  assert.throws(() => SharedPriceDataSchema.parse({ mode: "RANGE", currency: "BYN", min: 20, max: 10, items: [], note: "" }));
});

test("survives JSON serialization without semantic loss", () => {
  const value = sharedPriceFromPublication({ priceMode: "EXACT", priceFrom: 12.5 });
  assert.deepEqual(SharedPriceDataSchema.parse(JSON.parse(JSON.stringify(value))), value);
});
