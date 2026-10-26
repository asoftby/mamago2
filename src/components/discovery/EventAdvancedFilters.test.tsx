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

test("price range keeps two accessible thumbs and shared URL writes", () => {
  const source = readFileSync(new URL("./EventAdvancedFilters.tsx", import.meta.url), "utf8");

  assert.match(source, /role="slider"/);
  assert.match(source, /"min", "max"/);
  assert.match(source, /onPointerDown=\{/);
  assert.match(source, /onPointerMove=\{/);
  assert.match(source, /onKeyDown=\{/);
  assert.match(source, /bg-primary/);
  assert.match(source, /border-primary/);
  assert.match(source, /actions\.setDraft/);
  assert.match(source, /params\.delete\("priceMin"\)/);
  assert.match(source, /params\.delete\("priceMax"\)/);
});

test("event modal shares the URL who filter, including Halloween occasion", () => {
  const source = readFileSync(new URL("./EventAdvancedFilters.tsx", import.meta.url), "utf8");
  assert.match(source, /DiscoveryWhoFilter inline/);
  assert.match(source, /Повод/);
  assert.match(source, /draft\.occasionSlug === "halloween"/);
  assert.match(source, /useEventAvailableFacets/);
});

test("resetting all Kuda filters clears who, when, Halloween and refinements", () => {
  const current = {
    ...defaultFilters,
    whenPreset: "WEEKEND" as const,
    profile: "child-1",
    age: ["3-5"],
    occasionSlug: "halloween",
    categories: ["concerts"],
    genres: ["jazz"],
    format: "ONLINE" as const,
    free: true,
  };
  assert.deepEqual(resetEventRefinements(current), defaultFilters);
});

test("badge includes who, date, occasion and secondary dimensions", () => {
  assert.equal(getEventRefinementCount({
    ...defaultFilters,
    whenPreset: "TODAY", age: ["3-5"], profile: "child-1",
    occasionSlug: "halloween",
  }), 3);
  assert.equal(getEventRefinementCount({
    ...defaultFilters,
    categories: ["concerts"], genres: ["jazz"],
    format: "OFFLINE", priceMin: 20, priceMax: 50,
  }), 4);
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

test("mobile filter button uses the same URL filter count as desktop", () => {
  const source = readFileSync(
    new URL("../mobile/MobileFilterButton.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /getEventRefinementCount\(applied\)/);
  assert.doesNotMatch(source, /derived\.activeCount/);
});
