import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { normalizePriceSliderValue, priceSliderValueFromKey, priceSliderValueFromPosition } from "./EventAdvancedFilters";

test("price range uses native input events and keeps URL writes behind Apply", () => {
  const source = readFileSync(new URL("./EventAdvancedFilters.tsx", import.meta.url), "utf8");

  assert.match(source, /type="range"/);
  assert.match(source, /onInput=\{/);
  assert.match(source, /onPointerDown=\{/);
  assert.match(source, /onKeyDown=\{/);
  assert.equal(source.match(/actions\.commitFilters\(/g)?.length, 1);
  assert.match(source, /params\.delete\("priceMax"\)/);
});

test("price range normalizes selected and unbounded values", () => {
  assert.equal(normalizePriceSliderValue("50", 60), 50);
  assert.equal(normalizePriceSliderValue("60", 60), null);
  assert.equal(priceSliderValueFromPosition(50, 0, 60, 60, 10), 50);
  assert.equal(priceSliderValueFromKey("ArrowLeft", 60, 60, 10), 50);
  assert.equal(priceSliderValueFromKey("End", 50, 60, 10), 60);
});
