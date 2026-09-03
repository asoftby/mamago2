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

test("adapts persisted Offer pricing options without losing tier metadata", () => {
  const value = sharedPriceFromPublication({
    priceMode: "RANGE",
    priceFrom: 20,
    priceTo: 40,
    currency: "BYN",
    priceItems: [
      { title: "Детский", price: 20, description: "До 12 лет" },
      { id: "adult", title: "Взрослый", price: 40, oldPrice: 50, unit: "BYN" },
    ],
  });
  assert.equal(value.mode, "RANGE");
  assert.deepEqual(value.items, [
    { id: "offer-price-0", label: "Детский", price: "20", unit: "BYN", description: "До 12 лет" },
    { id: "adult", label: "Взрослый", price: "40", unit: "BYN", oldPrice: "50" },
  ]);
  assert.deepEqual(SharedPriceDataSchema.parse(JSON.parse(JSON.stringify(value))), value);
});

test("keeps canonical Event/Place price items unchanged", () => {
  const source = {
    items: [{ id: "base", label: "Билет", price: "15", unit: "BYN" }],
    note: "Без комиссии",
  };
  const value = sharedPriceFromPublication({ priceItems: source });
  assert.deepEqual(value.items, source.items);
  assert.equal(value.note, source.note);
  assert.equal(value.mode, "EXACT");
});

test("rejects invalid mode/value combinations", () => {
  assert.throws(() => SharedPriceDataSchema.parse({ mode: "FROM", currency: "BYN", min: 10, max: 20, items: [], note: "" }));
  assert.throws(() => SharedPriceDataSchema.parse({ mode: "RANGE", currency: "BYN", min: 20, max: 10, items: [], note: "" }));
});

test("survives JSON serialization without semantic loss", () => {
  const value = sharedPriceFromPublication({ priceMode: "EXACT", priceFrom: 12.5 });
  assert.deepEqual(SharedPriceDataSchema.parse(JSON.parse(JSON.stringify(value))), value);
});
