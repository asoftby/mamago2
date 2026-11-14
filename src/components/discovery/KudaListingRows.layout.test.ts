import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./KudaMasonryListing.tsx", import.meta.url), "utf8");

test("Kuda listing is an ordered masonry with 2 / 3 / 4 responsive columns", () => {
  assert.ok(source.includes("distributeIntoColumns"));
  assert.ok(source.includes("(min-width: 640px)") && source.includes("(min-width: 768px)"));
  assert.ok(source.includes("sm:grid-cols-3") && source.includes("md:grid-cols-4"));
  assert.ok(source.includes("stackColumns"));
});

test("SSR / hydration renders each card once in feed order (no per-breakpoint DOM copies)", () => {
  assert.ok(source.includes("columnCount == null"));
  assert.ok(source.includes("useState<number | null>(null)"));
  assert.ok(!source.includes("hidden sm:") && !source.includes("sm:hidden"));
});

test("main and alternative feeds both use the masonry with their own rows", () => {
  assert.ok(source.includes("<KudaListingRows items={primaryRows} columnCount={columnCount} />"));
  assert.ok(source.includes("<KudaListingRows items={secondaryRows} columnCount={columnCount} />"));
  assert.equal(source.split("<KudaListingRows").length - 1, 2);
});

test("no per-card observers; priority covers, analytics and back-restore are kept", () => {
  assert.ok(!source.includes("observer.observe(card"));
  assert.ok(source.includes("PRIORITY_COUNT") && source.includes("AnalyticsCardViewTracker"));
  assert.ok(source.includes("isBackForwardNavigation") && source.includes("sessionStorage"));
});

test("cards are never re-parented when the column count changes (identity preserved)", () => {
  // One container, one keyed card list: no per-column wrapper elements.
  assert.equal(source.split("items.map(({ key, content })").length - 1, 1);
  assert.ok(!source.includes("flex-col"));
  assert.ok(!source.includes("columns.map("));
  assert.ok(!source.includes("createPortal"));
  // Positioning is imperative on the same nodes.
  assert.ok(source.includes("card.style.transform"));
  // Only one observer, on the container; none per card.
  assert.equal(source.split("new ResizeObserver").length - 1, 1);
});
