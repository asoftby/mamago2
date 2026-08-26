import assert from "node:assert/strict";
import test from "node:test";
import { formatPublicCardPrice } from "./publicCardPrice";

test("formats canonical public card price semantics", () => {
  assert.equal(formatPublicCardPrice({ priceMode: "FREE", priceFrom: 0 }), "Бесплатно");
  assert.equal(formatPublicCardPrice({ priceMode: "EXACT", priceFrom: 30, priceTo: 30 }), "30,00 \uE901");
  assert.equal(formatPublicCardPrice({ priceMode: "FROM", priceFrom: 30 }), "от 30,00 \uE901");
  assert.equal(formatPublicCardPrice({ priceMode: "RANGE", priceFrom: 30, priceTo: 120 }), "от 30,00 \uE901");
  assert.equal(formatPublicCardPrice({ priceMode: "NONE", priceFrom: null }), null);
  assert.equal(formatPublicCardPrice({ priceMode: "UNKNOWN", priceFrom: 999 }), null);
  assert.equal(formatPublicCardPrice({ priceMode: "EXACT", priceFrom: 1200.5 }), "1 200,50 \uE901");
});
