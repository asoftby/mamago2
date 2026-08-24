import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { normalizePriceSliderValue } from "./EventAdvancedFilters";

test("price range uses native input events and keeps URL writes behind Apply", () => {
  const source = readFileSync(new URL("./EventAdvancedFilters.tsx", import.meta.url), "utf8");

  assert.match(source, /type="range"/);
  assert.match(source, /onInput=\{/);
  assert.equal(source.match(/actions\.commitFilters\(/g)?.length, 1);
  assert.match(source, /params\.delete\("priceMax"\)/);
});

test("price range normalizes selected and unbounded values", () => {
  assert.equal(normalizePriceSliderValue("50", 60), 50);
  assert.equal(normalizePriceSliderValue("60", 60), null);
});
