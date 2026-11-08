import assert from "node:assert/strict";
import { isDayScenarioEngineEnabled } from "./flag";
import type { PrismaClient } from "@prisma/client";
import { geoCellsFor } from "@/lib/geo/geoCell";
import { extendPrismaWithPlaceGeoCells } from "@/lib/place/placeGeoCellExtension";
import {
  hasStaleStoredCells,
  hasStaleStoredPlaceCells,
  resolveEventGeo,
  toPoolEvent,
  toPoolPlace,
  toVirtualPoolEvent,
  virtualSessionStarts,
  type PoolActivityRow,
  type PoolPlaceRow,
} from "./poolMapping";
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
  const truth = geoCellsFor(53.9006, 27.559)!;
  const fromPlace = resolveEventGeo({ ...base, place: placeGeo(53.9006, 27.559, truth.geoCell6, truth.geoCell5) });
  assert.deepEqual([fromPlace?.geoCell6, fromPlace?.geoCell5, fromPlace?.approximate], [truth.geoCell6, truth.geoCell5, false]);
  assert.equal(hasStaleStoredCells({ ...base, place: placeGeo(53.9006, 27.559, truth.geoCell6, truth.geoCell5) }), false, "consistent cells are not stale");
  // A Place moved while the Place extension was off: lat/lng changed, stored cells stayed old.
  {
    process.env.DAY_SCENARIO_ENGINE_ENABLED = "false";
    type Hook = (a: { args: Record<string, unknown>; query: (a: unknown) => Promise<unknown> }) => Promise<unknown>;
    let hooks: Record<string, Hook> = {};
    const fake = { $extends: (def: { query: { place: Record<string, Hook> } }) => { hooks = def.query.place; return {}; } } as unknown as PrismaClient;
    extendPrismaWithPlaceGeoCells(fake, fake);
    const written: Record<string, unknown>[] = [];
    await hooks.update({ args: { where: { id: "p" }, data: { lat: 53.9300, lng: 27.6200 } }, query: async (a) => { written.push((a as { data: Record<string, unknown> }).data); return a; } });
    assert.equal("geoCell6" in written[0]!, false, "flag off: the write leaves the stored cells untouched (stale)");

    const old = geoCellsFor(53.9006, 27.559)!; // cells stored before the move
    const moved = geoCellsFor(53.9300, 27.6200)!;
    assert.notEqual(old.geoCell6, moved.geoCell6);
    const row: PoolActivityRow = { ...base, place: placeGeo(53.9300, 27.6200, old.geoCell6, old.geoCell5) };
    const geo = resolveEventGeo(row)!;
    assert.deepEqual([geo.geoCell6, geo.geoCell5], [moved.geoCell6, moved.geoCell5], "engine puts the moved place into the correct cell");
    assert.equal(hasStaleStoredCells(row), true, "and the stale stored cells are detected for the pool log counter");
    assert.equal(hasStaleStoredCells({ ...base, place: placeGeo(53.9300, 27.6200) }), false, "no stored cells -> nothing to compare");
    assert.equal(hasStaleStoredCells({ ...base, venue: { addressLine: null, lat: null, lng: null, place: placeGeo(53.9300, 27.6200, old.geoCell6, old.geoCell5) } }), true, "venue place is checked too");
  }
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
  // planning window: defaults 09:00-20:00, narrowable (e.g. a weekday 16:00-20:00), at least an hour wide
  assert.deepEqual([ok.dayStart, ok.dayEnd], ["09:00", "20:00"]);
  const weekday = draftRequestSchema.parse({ date: "2026-11-11", dayStart: "16:00", dayEnd: "20:00" });
  assert.deepEqual([weekday.dayStart, weekday.dayEnd], ["16:00", "20:00"]);
  assert.equal(draftRequestSchema.safeParse({ date: "2026-11-11", dayStart: "19:30", dayEnd: "20:00" }).success, false, "window shorter than an hour");
  assert.equal(draftRequestSchema.safeParse({ date: "2026-11-11", dayStart: "20:00", dayEnd: "16:00" }).success, false, "end before start");
  assert.equal(draftRequestSchema.safeParse({ date: "2026-11-11", dayStart: "9:00" }).success, false, "HH:MM only");
  assert.equal(draftRequestSchema.safeParse({ date: "2026-11-11", dayEnd: "24:00" }).success, false);

  // --- filler places ---
  const DAY = "2026-11-14"; // Saturday
  const placeRow = (over: Partial<PoolPlaceRow> = {}): PoolPlaceRow => ({
    id: "pl1", slug: "pl1", title: "Парк", lat: 53.9006, lng: 27.559, geoCell6: null, geoCell5: null,
    shortAddress: "ул. Парковая 1", formattedAddr: null, customAddress: null,
    primaryCategory: { id: "c1", slug: "parks", nameRu: "Парки" },
    agePolicy: "UNKNOWN", ageTags: [],
    images: [{ url: "https://x/logo.png", kind: "LOGO" }, { url: "https://x/cover.jpg", kind: "GALLERY" }],
    openingHours: null, ...over,
  });
  const weeklyHours = (rules: NonNullable<PoolPlaceRow["openingHours"]>["rules"], extra: Partial<NonNullable<PoolPlaceRow["openingHours"]>> = {}): PoolPlaceRow["openingHours"] =>
    ({ mode: "WEEKLY", timezone: "Europe/Minsk", rules, exceptions: [], ...extra });

  const unknown = toPoolPlace(placeRow(), DAY)!;
  assert.deepEqual([unknown.kind, unknown.availability?.kind, unknown.uncategorized, unknown.durationMin], ["place", "unknown", false, 90], "no hours record -> kept as unknown");
  assert.equal(unknown.card.coverImageUrl, "https://x/cover.jpg", "cover prefers a non-logo image");
  assert.equal(unknown.activityId, "pl1");
  assert.equal(toPoolPlace(placeRow({ lat: null, lng: null }), DAY), null, "no coordinates -> not a filler");
  assert.equal(toPoolPlace(placeRow({ lat: 0, lng: 0 }), DAY), null);

  assert.equal(toPoolPlace(placeRow({ openingHours: { mode: "BY_APPOINTMENT", timezone: "Europe/Minsk", rules: [], exceptions: [] } }), DAY), null, "by appointment is excluded");
  assert.equal(toPoolPlace(placeRow({ openingHours: { mode: "TEMPORARILY_CLOSED", timezone: "Europe/Minsk", rules: [], exceptions: [] } }), DAY), null, "temporarily closed is excluded");
  assert.equal(toPoolPlace(placeRow({ openingHours: weeklyHours([{ dayOfWeek: "SUN", isOpen: true, allDay: true, intervals: [] }]) }), DAY), null, "closed on that weekday -> excluded");
  assert.equal(toPoolPlace(placeRow({ openingHours: weeklyHours([{ dayOfWeek: "SAT", isOpen: true, allDay: true, intervals: [] }], { exceptions: [{ date: DAY, isClosed: true, allDay: false, intervals: [] }] }) }), DAY), null, "closed by an exception on the date");

  const always = toPoolPlace(placeRow({ openingHours: { mode: "ALWAYS_OPEN", timezone: "Europe/Minsk", rules: [], exceptions: [] } }), DAY)!;
  assert.equal(always.availability?.kind, "always");

  const windowed = toPoolPlace(placeRow({ openingHours: weeklyHours([{ dayOfWeek: "SAT", isOpen: true, allDay: false, intervals: [{ startTime: "10:00", endTime: "18:30" }] }]) }), DAY)!;
  assert.deepEqual(windowed.availability, { kind: "windows", windows: [{ startMs: Date.parse("2026-11-14T07:00:00Z"), endMs: Date.parse("2026-11-14T15:30:00Z") }] }, "10:00-18:30 Minsk time -> UTC ms");

  // durations: 90 by default, 60 for the cafe category (by slug or by name), uncategorized still gets 90
  assert.equal(toPoolPlace(placeRow({ primaryCategory: { id: "c2", slug: "food", nameRu: "Кафе и еда" } }), DAY)!.durationMin, 60);
  assert.equal(toPoolPlace(placeRow({ primaryCategory: { id: "c2", slug: "other-slug", nameRu: "Кафе и еда" } }), DAY)!.durationMin, 60, "matched by name too");
  const nocat = toPoolPlace(placeRow({ primaryCategory: null }), DAY)!;
  assert.deepEqual([nocat.uncategorized, nocat.durationMin, nocat.card.categoryName], [true, 90, null]);

  // stored cells on places are compared with lat/lng
  const truthP = geoCellsFor(53.9006, 27.559)!;
  assert.equal(hasStaleStoredPlaceCells({ lat: 53.9006, lng: 27.559, geoCell6: truthP.geoCell6, geoCell5: truthP.geoCell5 }), false);
  assert.equal(hasStaleStoredPlaceCells({ lat: 53.93, lng: 27.62, geoCell6: truthP.geoCell6, geoCell5: truthP.geoCell5 }), true);
  assert.equal(hasStaleStoredPlaceCells({ lat: 53.93, lng: 27.62, geoCell6: null, geoCell5: null }), false);

  // age restrictions of places are carried into the pool (so the builder can enforce them)
  const adults = toPoolPlace(placeRow({ agePolicy: "ADULT_ONLY" }), DAY)!;
  assert.deepEqual([adults.adultOnly, adults.ageTags], [true, []]);
  const kids = toPoolPlace(placeRow({ agePolicy: "SPECIFIC", ageTags: ["3-5", "5-7"] }), DAY)!;
  assert.deepEqual([kids.adultOnly, kids.ageTags], [false, ["3-5", "5-7"]]);
  assert.deepEqual([unknown.adultOnly, unknown.ageTags], [false, []], "no restriction stored -> suitable for everyone");

  // --- virtual sessions: events with a schedule but no ActivitySession rows ---
  {
    const TZ = "Europe/Minsk";
    const weekly = { scheduleItems: [{ date: "2026-11-07", startTime: "11:00", recurringEnabled: true, recurrenceInterval: 1, recurrenceUnit: "week", recurrenceUntil: "2027-02-01" }] };
    const noon = Date.parse("2026-11-14T00:00:00Z");
    assert.deepEqual(virtualSessionStarts(weekly, "2026-11-14", TZ, noon), [Date.parse("2026-11-14T08:00:00Z")], "weekly rule lands on Saturday 11:00 Minsk (08:00Z)");
    assert.deepEqual(virtualSessionStarts(weekly, "2026-11-11", TZ, noon), [], "a Wednesday is not on the weekly rule");
    assert.deepEqual(virtualSessionStarts(weekly, "2027-02-13", TZ, noon), [], "after recurrenceUntil nothing is generated");
    assert.deepEqual(virtualSessionStarts(weekly, "2026-11-14", TZ, Date.parse("2026-11-14T09:00:00Z")), [], "a start already in the past is dropped");
    const twoTimes = { dates: ["2026-11-14"], scheduleItems: [{ date: "2026-11-14", startTime: "10:00" }, { date: "2026-11-14", startTime: "15:30" }] };
    assert.deepEqual(virtualSessionStarts(twoTimes, "2026-11-14", TZ, noon), [Date.parse("2026-11-14T07:00:00Z"), Date.parse("2026-11-14T12:30:00Z")], "two times on a date stay two starts, ascending");
    assert.deepEqual(virtualSessionStarts(null, "2026-11-14", TZ, noon), [], "no scheduleJson, no virtual session");
    assert.deepEqual(virtualSessionStarts({ foo: 1 }, "2026-11-14", TZ, noon), [], "an unreadable schedule yields nothing instead of throwing");

    const { sessions: _unused, ...rowWithoutSessions } = base;
    void _unused;
    const withRule = { ...rowWithoutSessions, scheduleJson: weekly, place: placeGeo(53.9006, 27.559) };
    const virtual = toVirtualPoolEvent(withRule, 3, "2026-11-14", TZ, noon)!;
    assert.equal(virtual.virtualSession, true);
    assert.deepEqual(virtual.sessionStartsMs, [Date.parse("2026-11-14T08:00:00Z")]);
    assert.equal(virtual.kind, "event");
    assert.equal(virtual.engagementScore, 3);
    assert.ok(virtual.geo, "a virtual event keeps its venue geo");
    assert.equal(toVirtualPoolEvent(withRule, 3, "2026-11-11", TZ, noon), null, "no occurrence on the day -> not in the pool");
    assert.equal(toPoolEvent(base, 0)?.virtualSession, undefined, "real sessions are never marked virtual");
  }

  // --- config route: the browser learns the flag from the server, read at request time ---
  {
    const { GET } = await import("@/app/api/plan/day-scenario/config/route");
    const previous = process.env.DAY_SCENARIO_ENGINE_ENABLED;
    delete process.env.DAY_SCENARIO_ENGINE_ENABLED;
    const off = await GET();
    assert.deepEqual(await off.json(), { enabled: false });
    process.env.DAY_SCENARIO_ENGINE_ENABLED = "true";
    const on = await GET();
    assert.deepEqual(await on.json(), { enabled: true }, "read per request, not frozen at import");
    assert.equal(on.headers.get("cache-control"), "private, max-age=300", "no shared cache; the browser keeps it five minutes");
    if (previous === undefined) delete process.env.DAY_SCENARIO_ENGINE_ENABLED;
    else process.env.DAY_SCENARIO_ENGINE_ENABLED = previous;
  }

  console.log("dayScenarioEngine tests passed");
}

main().catch((error) => { console.error(error); process.exit(1); });
