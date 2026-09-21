import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { defaultFilters } from "@/features/filters/discovery/filters.store";
import {
  getEventRefinementCount,
  normalizePriceMinSliderValue,
  normalizePriceSliderValue,
  priceSliderValueFromKey,
  priceSliderValueFromPosition,
  resetEventRefinements,
} from "./EventAdvancedFilters";

test("price range uses two accessible custom thumbs and keeps URL writes behind Apply", () => {
  const source = readFileSync(new URL("./EventAdvancedFilters.tsx", import.meta.url), "utf8");

  assert.match(source, /role="slider"/);
  assert.match(source, /"min", "max"/);
  assert.match(source, /onPointerDown=\{/);
  assert.match(source, /onPointerMove=\{/);
  assert.match(source, /onKeyDown=\{/);
  assert.match(source, /bg-primary/);
  assert.match(source, /border-primary/);
  assert.equal(source.match(/actions\.commitFilters\(/g)?.length, 1);
  assert.match(source, /params\.delete\("priceMin"\)/);
  assert.match(source, /params\.delete\("priceMax"\)/);
});

test("advanced event filters do not duplicate global header context", () => {
  const source = readFileSync(new URL("./EventAdvancedFilters.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /AGE_GROUPS/);
  assert.doesNotMatch(source, /draft\.district/);
  assert.doesNotMatch(source, /draft\.metro/);
  assert.doesNotMatch(source, /Возраст · общий профиль/);
  assert.doesNotMatch(source, /Где в городе/);
});

test("resetting refinements preserves where, when and who", () => {
  const current = {
    ...defaultFilters,
    whenPreset: "WEEKEND" as const,
    age: ["18+"],
    district: "central",
    metro: "nemiga",
    categories: ["concerts"],
    genres: ["jazz"],
    format: "ONLINE" as const,
    free: true,
    priceMin: 20,
    priceMax: 80,
    adultOnly: true,
  };

  const reset = resetEventRefinements(current);

  assert.equal(reset.whenPreset, "WEEKEND");
  assert.deepEqual(reset.age, ["18+"]);
  assert.equal(reset.district, "central");
  assert.equal(reset.metro, "nemiga");
  assert.deepEqual(reset.categories, []);
  assert.deepEqual(reset.genres, []);
  assert.equal(reset.format, null);
  assert.equal(reset.free, false);
  assert.equal(reset.priceMin, null);
  assert.equal(reset.priceMax, null);
  assert.equal(reset.adultOnly, false);
});

test("filter badge counts the whole price range as one refinement", () => {
  assert.equal(
    getEventRefinementCount({
      ...defaultFilters,
      whenPreset: "TODAY",
      age: ["3-5"],
      district: "central",
      metro: "nemiga",
    }),
    0,
  );

  assert.equal(
    getEventRefinementCount({
      ...defaultFilters,
      categories: ["concerts"],
      genres: ["jazz"],
      format: "OFFLINE",
      priceMin: 20,
      priceMax: 50,
    }),
    4,
  );
});

test("price range normalizes selected and unbounded values", () => {
  assert.equal(normalizePriceMinSliderValue("0"), null);
  assert.equal(normalizePriceMinSliderValue("20"), 20);
  assert.equal(normalizePriceSliderValue("50", 60), 50);
  assert.equal(normalizePriceSliderValue("60", 60), null);
  assert.equal(priceSliderValueFromPosition(50, 0, 60, 60, 10), 50);
  assert.equal(priceSliderValueFromKey("ArrowLeft", 60, 60, 10), 50);
  assert.equal(priceSliderValueFromKey("End", 50, 60, 10), 60);
});
