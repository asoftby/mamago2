import assert from "node:assert/strict";
import { isDayScenarioEngineEnabled } from "./flag";
import { resolveEventGeo, toPoolEvent, type PoolActivityRow } from "./poolMapping";
import { createTtlCache } from "./ttlCache";
import { draftRequestSchema } from "./draft.service";

async function main() {
  // --- flag: off unless exactly "true" ---
  assert.equal(isDayScenarioEngineEnabled({}), false);
  assert.equal(isDayScenarioEngineEnabled({ DAY_SCENARIO_ENGINE_ENABLED: "1" }), false);
  assert.equal(isDayScenarioEngineEnabled({ DAY_SCENARIO_ENGINE_ENABLED: "false" }), false);
  assert.equal(isDayScenarioEngineEnabled({ DAY_SCENARIO_ENGINE_ENABLED: "true" }), true);

  // --- TTL cache: hit within TTL, miss after, in-flight dedupe, bounded size ---
  let t = 1_000;
  const cache = createTtlCache<number>({ ttlMs: 600_000, maxEntries: 2, now: () => t });
  let loads = 0;
  const load = async () => { loads += 1; return loads; };
  const first = await cache.get("k", load);
  assert.deepEqual([first.value, first.hit], [1, false]);
  const second = await cache.get("k", load);
  assert.deepEqual([second.value, second.hit], [1, true]);
  assert.equal(loads, 1, "0 loads (0 DB reads) within the TTL");
  t += 600_001;
  const third = await cache.get("k", load);
  assert.deepEqual([third.value, third.hit], [2, false], "reloads after TTL");

  const dedupe = createTtlCache<number>({ ttlMs: 1000, maxEntries: 4, now: () => t });
  let slow = 0;
  const slowLoad = () => new Promise<number>((resolve) => setTimeout(() => resolve(++slow), 10));
  const [r1, r2] = await Promise.all([dedupe.get("x", slowLoad), dedupe.get("x", slowLoad)]);
  assert.equal(slow, 1, "concurrent misses share one load");
  assert.equal(r1.value, r2.value);

  const bounded = createTtlCache<number>({ ttlMs: 1000, maxEntries: 2, now: () => t });
  for (const k of ["a", "b", "c"]) await bounded.get(k, async () => 1);
  assert.ok(bounded.size() <= 2, "evicts oldest beyond maxEntries");

  const failing = createTtlCache<number>({ ttlMs: 1000, maxEntries: 2, now: () => t });
  await assert.rejects(failing.get("e", async () => { throw new Error("db down"); }));
  const recovered = await failing.get("e", async () => 7);
  assert.equal(recovered.value, 7, "a failed load is not cached");

  // --- geo resolution order: place -> venue.place -> venue coords -> metro (approximate) ---
  const placeGeo = (lat: number | null, lng: number | null, c6: string | null = null, c5: string | null = null) => ({
    lat, lng, geoCell6: c6, geoCell5: c5, shortAddress: "Addr", formattedAddr: null, customAddress: null,
  });
  const base: PoolActivityRow = {
    id: "a1", slug: "a1", title: "T", coverImageUrl: null, ageLabel: null, ageTags: [], agePolicy: "ALL",
    eventCategory: null, priceFrom: null, priceTo: null, priceText: null, currency: null, scheduleJson: null,
    format: null, discoverySignalIds: [], place: null, venue: null, metroStation: null,
    sessions: [{ startsAt: new Date("2026-11-08T08:00:00Z") }],
  };
  const fromPlace = resolveEventGeo({ ...base, place: placeGeo(53.9006, 27.559, "u9efk3", "u9efk") });
  assert.deepEqual([fromPlace?.geoCell6, fromPlace?.approximate], ["u9efk3", false], "stored cells are used when present");
  const computed = resolveEventGeo({ ...base, place: placeGeo(53.9006, 27.559) });
  assert.equal(computed?.geoCell6.length, 6, "missing stored cells are computed from lat/lng");
  const viaVenuePlace = resolveEventGeo({ ...base, venue: { addressLine: "v", lat: 1, lng: 1, place: placeGeo(53.9, 27.55) } });
  assert.ok(viaVenuePlace && !viaVenuePlace.approximate && Math.abs(viaVenuePlace.lat - 53.9) < 1e-9);
  const viaVenueCoords = resolveEventGeo({ ...base, venue: { addressLine: "v", lat: 53.91, lng: 27.56, place: null } });
  assert.ok(viaVenueCoords && !viaVenueCoords.approximate);
  const metro = resolveEventGeo({ ...base, metroStation: { lat: 53.92, lng: 27.57 } });
  assert.equal(metro?.approximate, true);
  assert.equal(resolveEventGeo(base), null);
  assert.equal(resolveEventGeo({ ...base, place: placeGeo(0, 0) }), null, "(0,0) is not a position");

  // --- pool event mapping ---
  assert.equal(toPoolEvent({ ...base, sessions: [] }, 5), null, "no session on the day -> not poolable");
  const mapped = toPoolEvent({ ...base, place: placeGeo(53.9, 27.55), agePolicy: "ADULT_ONLY" }, 7)!;
  assert.equal(mapped.adultOnly, true);
  assert.equal(mapped.engagementScore, 7);
  assert.equal(mapped.card.address, "Addr");

  // --- request schema ---
  const ok = draftRequestSchema.parse({ date: "2026-11-08" });
  assert.deepEqual([ok.city, ok.mode, ok.action, ok.targetCount, ok.variant], ["minsk", "car", "build", 3, 0]);
  assert.equal(draftRequestSchema.safeParse({ date: "2026-13-40" }).success, false, "calendar-valid dates only");
  assert.equal(draftRequestSchema.safeParse({ date: "2026-11-08", mode: "bike" }).success, false);
  assert.equal(draftRequestSchema.safeParse({ date: "2026-11-08", targetCount: 9 }).success, false);
  assert.equal(draftRequestSchema.safeParse({ date: "2026-11-08", ageRanges: ["3-5"] }).success, true);

  console.log("dayScenarioEngine tests passed");
}

main().catch((error) => { console.error(error); process.exit(1); });
