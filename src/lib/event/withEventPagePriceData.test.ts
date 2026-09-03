/**
 * Regression tests for Event public structured pricing.
 * Run: npx tsx src/lib/event/withEventPagePriceData.test.ts
 */
import assert from "node:assert/strict";
import type { EventPageData } from "./eventPageTypes";
import { withEventPagePriceData } from "./withEventPagePriceData";

const base = {} as EventPageData;

function testObjectPriceData() {
  const result = withEventPagePriceData(base, {
    items: [
      {
        id: "child",
        label: "Детский билет",
        price: "30 BYN",
        unit: "",
      },
      {
        id: "adult",
        label: "Взрослый билет",
        price: "50 BYN",
        unit: "",
      },
    ],
    note: "Детям до 3 лет бесплатно",
  });

  assert.equal(result.priceItems?.length, 2);
  assert.equal(result.priceItems?.[0]?.label, "Детский билет");
  assert.equal(result.priceNote, "Детям до 3 лет бесплатно");
}

function testLegacyArrayPriceData() {
  const result = withEventPagePriceData(base, [
    {
      id: "family",
      label: "Семейный билет",
      price: "80 BYN",
      unit: "",
    },
  ]);

  assert.equal(result.priceItems?.length, 1);
  assert.equal(result.priceItems?.[0]?.price, "80 BYN");
  assert.equal(result.priceNote, "");
}

function testInvalidPriceDataIsSafe() {
  const result = withEventPagePriceData(base, { items: "broken", note: 123 });

  assert.deepEqual(result.priceItems, []);
  assert.equal(result.priceNote, "");
}

function main() {
  testObjectPriceData();
  testLegacyArrayPriceData();
  testInvalidPriceDataIsSafe();
  console.log("withEventPagePriceData tests: OK");
}

main();
