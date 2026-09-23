import assert from "node:assert/strict";
import { BYN_SYMBOL } from "@/lib/formatters/format-price";
import { formatStoryPrice } from "./storyPrice";

assert.equal(
  formatStoryPrice({ priceMode: "EXACT", priceFrom: 2 }),
  `2,00 ${BYN_SYMBOL}`,
);
assert.equal(
  formatStoryPrice({ priceMode: "FROM", priceFrom: 31 }),
  `от 31,00 ${BYN_SYMBOL}`,
);
assert.equal(
  formatStoryPrice({ priceMode: "RANGE", priceFrom: 31, priceTo: 59 }),
  `31,00–59,00 ${BYN_SYMBOL}`,
);
assert.equal(
  formatStoryPrice({ priceMode: "FREE", priceFrom: 0 }),
  "Бесплатно",
);
assert.equal(
  formatStoryPrice({ priceMode: "UNKNOWN", priceFrom: 0 }),
  undefined,
);
assert.equal(
  formatStoryPrice({ priceMode: "UNKNOWN", priceText: "31 - 59" }),
  `31,00–59,00 ${BYN_SYMBOL}`,
);
assert.equal(
  formatStoryPrice({ priceText: "2 BYN" }),
  `2,00 ${BYN_SYMBOL}`,
);

console.log("storyPrice tests: OK");
