import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEffectivePlaceDistrictWhere,
  buildEffectivePlaceMetroWhere,
  buildEventRuntimeWhere,
  effectiveEventSessionStart,
  isStructuredFreeEvent,
  matchesCanonicalStartingPrice,
  matchesPublicFreePrice,
  resolveEventDateRange,
} from "./eventFilterSemantics";

test("date presets use Europe/Minsk calendar boundaries", () => {
  const now = new Date("2026-08-12T21:30:00.000Z"); // 00:30 Thursday in Minsk
  const today = resolveEventDateRange({ preset: "TODAY" }, now);
  const tomorrow = resolveEventDateRange({ preset: "TOMORROW" }, now);
  assert.equal(today?.start.toISOString(), "2026-08-12T21:00:00.000Z");
  assert.equal(today?.end.toISOString(), "2026-08-13T21:00:00.000Z");
  assert.equal(tomorrow?.start.toISOString(), "2026-08-13T21:00:00.000Z");
});

test("weekend means the upcoming Minsk Saturday and Sunday", () => {
  const range = resolveEventDateRange(
    { preset: "WEEKEND" },
    new Date("2026-08-12T09:00:00.000Z"),
  );
  assert.equal(range?.start.toISOString(), "2026-08-14T21:00:00.000Z");
  assert.equal(range?.end.toISOString(), "2026-08-16T21:00:00.000Z");
});

test("custom dates are inclusive and invalid dates do not constrain results", () => {
  const range = resolveEventDateRange({ from: "2026-08-20", to: "2026-08-22" });
  assert.equal(range?.start.toISOString(), "2026-08-19T21:00:00.000Z");
  assert.equal(range?.end.toISOString(), "2026-08-22T21:00:00.000Z");
  assert.equal(resolveEventDateRange({ from: "not-a-date" }), null);
});

test("free requires explicit structured free state", () => {
  assert.equal(isStructuredFreeEvent({ priceFrom: 0 }), true);
  assert.equal(isStructuredFreeEvent({ priceFrom: null, scheduleJson: { pricingMode: "free" } }), true);
  assert.equal(isStructuredFreeEvent({ priceFrom: null, scheduleJson: {} }), false);
  assert.equal(isStructuredFreeEvent({ priceFrom: 45, scheduleJson: { pricingMode: "fixed" } }), false);
  assert.equal(isStructuredFreeEvent({ priceFrom: null }), false);
});

test("free also detects the wizard's free priceText, case/whitespace-insensitively", () => {
  assert.equal(isStructuredFreeEvent({ priceFrom: null, priceText: "Бесплатно" }), true);
  assert.equal(isStructuredFreeEvent({ priceFrom: null, priceText: "  free  " }), true);
  assert.equal(isStructuredFreeEvent({ priceFrom: null, priceText: "от 10 руб" }), false);
  assert.equal(isStructuredFreeEvent({ priceFrom: 25, priceText: "25 руб" }), false);
});

test("resolved date range becomes an active ActivitySession inclusion predicate", () => {
  const dateRange = resolveEventDateRange({ from: "2026-09-12" });
  const now = new Date("2026-09-01T09:00:00.000Z");
  const where = buildEventRuntimeWhere({ categorySlugs: [], genreSlugs: [], dateRange, free: false, priceMax: null, districtId: null, metroId: null, adultOnly: false }, now);
  assert.deepEqual(where, [{ sessions: { some: { startsAt: { gte: dateRange?.start, lt: dateRange?.end }, withdrawnAt: null } } }]);
});

test("today date chip excludes already-started sessions but keeps upcoming Minsk sessions", () => {
  const now = new Date("2026-11-04T09:03:00.000Z"); // 12:03 in Minsk
  const today = resolveEventDateRange({ preset: "TODAY" }, now);
  assert.ok(today);
  const filters = { dateRange: today, free: false, districtId: null, metroId: null, adultOnly: false };
  assert.deepEqual(buildEventRuntimeWhere(filters, now), [{
    sessions: { some: {
      startsAt: { gte: now, lt: today.end },
      withdrawnAt: null,
    } },
  }]);
  // 11:30 Minsk already elapsed, 18:00 Minsk is still available today.
  const expired = new Date("2026-11-04T08:30:00.000Z");
  const upcoming = new Date("2026-11-04T15:00:00.000Z");
  assert.ok(expired < effectiveEventSessionStart(today, now));
  assert.ok(upcoming >= effectiveEventSessionStart(today, now));
  assert.ok(upcoming < today.end);
});

test("tomorrow and future-weekend filters retain their full requested day windows", () => {
  const now = new Date("2026-11-04T09:03:00.000Z");
  for (const preset of ["TOMORROW", "WEEKEND"] as const) {
    const range = resolveEventDateRange({ preset }, now);
    assert.ok(range);
    assert.equal(effectiveEventSessionStart(range, now).toISOString(), range.start.toISOString());
    assert.deepEqual(buildEventRuntimeWhere({
      dateRange: range, free: false, districtId: null, metroId: null, adultOnly: false,
    }, now), [{
      sessions: { some: { startsAt: { gte: range.start, lt: range.end }, withdrawnAt: null } },
    }]);
  }
});

test("custom date windows spanning the past start no earlier than now", () => {
  const now = new Date("2026-11-04T09:03:00.000Z");
  const range = resolveEventDateRange({ from: "2026-11-03", to: "2026-11-05" }, now);
  assert.ok(range);
  assert.equal(effectiveEventSessionStart(range, now).toISOString(), now.toISOString());
  assert.equal(effectiveEventSessionStart(null, now), now);
});

test("manual geo assignment wins and auto is used only when manual is absent", () => {
  assert.deepEqual(buildEffectivePlaceDistrictWhere("district-1"), {
    OR: [
      { districtManualId: "district-1" },
      { districtManualId: null, districtAutoId: "district-1" },
    ],
  });
  assert.deepEqual(buildEffectivePlaceMetroWhere("metro-1"), {
    OR: [
      { metroManualId: "metro-1" },
      { metroManualId: null, metroAutoId: "metro-1" },
    ],
  });
});

test("adult-only uses the typed executable predicate", () => {
  assert.deepEqual(
    buildEventRuntimeWhere({ categorySlugs: [], genreSlugs: [], dateRange: null, free: false, priceMax: null, districtId: null, metroId: null, adultOnly: true }),
    [{ agePolicy: "ADULT_ONLY" }],
  );
});

test("categories and genres are OR within their dimension and AND with other dimensions", () => {
  assert.deepEqual(
    buildEventRuntimeWhere({
      categorySlugs: ["theatre", "workshops"],
      genreSlugs: ["puppet", "musical"],
      dateRange: null,
      free: true,
      priceMax: null,
      districtId: null,
      metroId: null,
      adultOnly: false,
    }),
    [
      { eventCategory: { is: { slug: { in: ["theatre", "workshops"] } } } },
      { genreSlugs: { hasSome: ["puppet", "musical"] } },
      {
        OR: [
          { priceMode: "FREE" },
          { priceMode: "UNKNOWN", priceFrom: 0, priceText: { in: ["бесплатно", "free"], mode: "insensitive" } },
        ],
      },
    ],
  );
});

test("free price filter admits explicit legacy zero/free label but not unknown placeholders", () => {
  assert.deepEqual(buildEventRuntimeWhere({
    dateRange: null, free: true, districtId: null, metroId: null, adultOnly: false,
  }), [{ OR: [
    { priceMode: "FREE" },
    { priceMode: "UNKNOWN", priceFrom: 0, priceText: { in: ["бесплатно", "free"], mode: "insensitive" } },
  ] }]);
});

test("FREE facet agrees with strict SQL rule and rejects imported zero-price placeholders", () => {
  assert.equal(matchesPublicFreePrice({ priceMode: "FREE", priceFrom: null, priceText: null }), true);
  assert.equal(matchesPublicFreePrice({ priceMode: "UNKNOWN", priceFrom: 0, priceText: "бесплатно" }), true);
  assert.equal(matchesPublicFreePrice({ priceMode: "UNKNOWN", priceFrom: 0, priceText: "FREE" }), true);
  assert.equal(matchesPublicFreePrice({ priceMode: "UNKNOWN", priceFrom: 0, priceText: " FREE " }), false);
  assert.equal(matchesPublicFreePrice({ priceMode: "UNKNOWN", priceFrom: 0, priceText: null }), false);
  assert.equal(matchesPublicFreePrice({ priceMode: "UNKNOWN", priceFrom: 0, priceText: "уточняется" }), false);
  assert.equal(matchesPublicFreePrice({ priceMode: "EXACT", priceFrom: 0, priceText: "бесплатно" }), false);
  assert.equal(matchesPublicFreePrice({ priceMode: "UNKNOWN", priceFrom: null, priceText: "бесплатно" }), false);
});

test("numeric max uses canonical starting price and excludes NONE and UNKNOWN", () => {
  assert.deepEqual(
    buildEventRuntimeWhere({ categorySlugs: [], genreSlugs: [], dateRange: null, free: false, priceMax: 50, districtId: null, metroId: null, adultOnly: false }),
    [{ priceMode: { in: ["FREE", "EXACT", "FROM", "RANGE"] }, priceFrom: { lte: 50 } }],
  );
});

test("numeric range applies both minimum and maximum to canonical starting price", () => {
  assert.deepEqual(
    buildEventRuntimeWhere({
      categorySlugs: [],
      genreSlugs: [],
      dateRange: null,
      free: false,
      priceMin: 20,
      priceMax: 50,
      districtId: null,
      metroId: null,
      adultOnly: false,
    }),
    [{
      priceMode: { in: ["FREE", "EXACT", "FROM", "RANGE"] },
      priceFrom: { gte: 20, lte: 50 },
    }],
  );
});

test("numeric max matches canonical modes by priceFrom while no max keeps every mode", () => {
  assert.equal(matchesCanonicalStartingPrice({ priceMode: "EXACT", priceFrom: 40 }, 50), true);
  assert.equal(matchesCanonicalStartingPrice({ priceMode: "EXACT", priceFrom: 60 }, 50), false);
  assert.equal(matchesCanonicalStartingPrice({ priceMode: "FROM", priceFrom: 30 }, 50), true);
  assert.equal(matchesCanonicalStartingPrice({ priceMode: "RANGE", priceFrom: 30 }, 50), true);
  assert.equal(matchesCanonicalStartingPrice({ priceMode: "FREE", priceFrom: 0 }, 50), true);
  assert.equal(matchesCanonicalStartingPrice({ priceMode: "NONE", priceFrom: null }, 50), false);
  assert.equal(matchesCanonicalStartingPrice({ priceMode: "UNKNOWN", priceFrom: null }, 50), false);
  assert.equal(matchesCanonicalStartingPrice({ priceMode: "NONE", priceFrom: null }, null), true);
  assert.equal(matchesCanonicalStartingPrice({ priceMode: "UNKNOWN", priceFrom: null }, null), true);
});

test("absent category and genre preserve the existing predicates", () => {
  assert.deepEqual(buildEventRuntimeWhere({ categorySlugs: [], genreSlugs: [], dateRange: null, free: false, priceMax: null, districtId: null, metroId: null, adultOnly: false }), []);
});


test("Halloween quick chip filters by linked active Occasion, not title keywords", () => {
  const input = {
    occasionSlug: "halloween",
    dateRange: null,
    free: false,
    districtId: null,
    metroId: null,
    adultOnly: false,
  };
  assert.deepEqual(buildEventRuntimeWhere(input), [{
    occasionLinks: { some: { occasion: { slug: "halloween", isActive: true } } },
  }]);
  assert.deepEqual(buildEventRuntimeWhere({ ...input, occasionSlug: null }), []);
});
