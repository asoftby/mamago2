import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildEventRuntimeWhere, resolveEventDateRange } from "@/server/discovery/eventFilterSemantics";

const routeSource = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

test("calendar density forwards canonical category and genre query values", () => {
  assert.match(routeSource, /p\.get\("category"\)\?\.split\(","\)\.filter\(Boolean\)/);
  assert.match(routeSource, /p\.get\("genre"\)\?\.split\(","\)\.filter\(Boolean\)/);
  assert.match(routeSource, /dateRange: null/);
});

test("category and genre constrain the same executable event predicate", () => {
  assert.deepEqual(
    buildEventRuntimeWhere({
      categorySlugs: ["theatre"],
      genreSlugs: ["puppet"],
      dateRange: null,
      free: false,
      priceMax: null,
      districtId: null,
      metroId: null,
      adultOnly: false,
    }),
    [
      { eventCategory: { is: { slug: { in: ["theatre"] } } } },
      { genreSlugs: { hasSome: ["puppet"] } },
    ],
  );
});

test("unknown genre remains an executable predicate and therefore matches no unrelated rows", () => {
  assert.deepEqual(
    buildEventRuntimeWhere({
      categorySlugs: [],
      genreSlugs: ["unknown-or-inactive"],
      dateRange: null,
      free: false,
      priceMax: null,
      districtId: null,
      metroId: null,
      adultOnly: false,
    }),
    [{ genreSlugs: { hasSome: ["unknown-or-inactive"] } }],
  );
});

test("calendar window remains an inclusive date selection independent of runtime date filters", () => {
  const window = resolveEventDateRange({ from: "2026-08-24", to: "2026-08-25" });
  assert.equal(window?.start.toISOString(), "2026-08-23T21:00:00.000Z");
  assert.equal(window?.end.toISOString(), "2026-08-25T21:00:00.000Z");
});
