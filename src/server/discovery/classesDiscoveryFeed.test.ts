import assert from "node:assert/strict";
import test from "node:test";
import { formatPublicCardPrice } from "@/domain/pricing/publicCardPrice";
import {
  buildCanonicalOfferPriceWhere,
  projectCanonicalOfferPrice,
} from "./classesDiscoveryFeed";

test("classes discovery preserves canonical Offer prices through card projection", () => {
  const cases = [
    { priceMode: "EXACT", priceFrom: 380, priceTo: 380, expected: "380,00 \uE901" },
    { priceMode: "FROM", priceFrom: 300, priceTo: null, expected: "от 300,00 \uE901" },
    { priceMode: "RANGE", priceFrom: 30, priceTo: 120, expected: "от 30,00 \uE901" },
    { priceMode: "NONE", priceFrom: null, priceTo: null, expected: null },
    { priceMode: "UNKNOWN", priceFrom: null, priceTo: null, expected: null },
  ] as const;

  for (const input of cases) {
    const projected = projectCanonicalOfferPrice({ ...input, currency: "BYN" });
    assert.equal(projected.priceMode, input.priceMode);
    assert.equal(
      formatPublicCardPrice({
        priceMode: projected.priceMode,
        priceFrom: projected.priceMin,
        priceTo: projected.priceMax,
        currency: projected.currency,
      }),
      input.expected,
    );
  }
});

test("classes discovery price filters use the same canonical semantics as events", () => {
  assert.deepEqual(buildCanonicalOfferPriceWhere({ free: true, priceMax: 50 }), {
    priceMode: "FREE",
  });
  assert.deepEqual(buildCanonicalOfferPriceWhere({ priceMax: 50 }), {
    priceMode: { in: ["FREE", "EXACT", "FROM", "RANGE"] },
    priceFrom: { lte: 50 },
  });
  assert.equal(buildCanonicalOfferPriceWhere({ priceMax: null }), null);
  assert.equal(buildCanonicalOfferPriceWhere({ priceMax: -1 }), null);
});
