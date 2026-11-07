import assert from "node:assert/strict";
import { geoCellsFor } from "@/lib/geo/geoCell";
import { buildDayScenario, replaceScenarioItem, type BuildDeps } from "./build";
import { TravelEstimator, travelLeg } from "./travel";
import type { BuildInput, PoolEvent } from "./types";

const DAY_START = Date.UTC(2026, 10, 8, 6, 0); // 09:00 Minsk
const WINDOW = { windowStartMs: DAY_START, windowEndMs: DAY_START + 11 * 3_600_000 };
const at = (hour: number) => DAY_START + (hour - 9) * 3_600_000;

function ev(id: string, lat: number | null, lng: number | null, hours: number[], score = 10, over: Partial<PoolEvent> = {}): PoolEvent {
  const cells = lat != null && lng != null ? geoCellsFor(lat, lng) : null;
  return {
    kind: "event",
    activityId: id,
    card: { id, slug: id, title: id, coverImageUrl: null, ageLabel: null, categoryName: null, priceFrom: null, priceTo: null, priceText: null, currency: null, address: null },
    sessionStartsMs: hours.map(at),
    durationMin: 90,
    ageTags: [],
    adultOnly: false,
    engagementScore: score,
    scheduleJson: null,
    categoryId: null,
    discoverySignalIds: [],
    format: null,
    geo: cells ? { lat: lat!, lng: lng!, ...cells, approximate: false } : null,
    ...over,
  };
}

const baseInput = (over: Partial<BuildInput> = {}): BuildInput => ({
  ...WINDOW, mode: "car", audience: { ageRanges: [], profileInterestSlugs: [], hasToddler: false },
  busy: [], excludeActivityIds: [], pinned: [], targetCount: 3, variant: 0, ...over,
});
const deps = (): BuildDeps => ({ scoreOf: (e) => e.engagementScore, estimator: new TravelEstimator() });

// Minsk landmarks (approximate): ~600 m apart in a tight cluster, plus far districts.
const A = { lat: 53.9006, lng: 27.559 };
const B = { lat: 53.9055, lng: 27.5612 }; // ~560 m from A
const C = { lat: 53.9100, lng: 27.5650 }; // ~600 m from B
const FAR = { lat: 53.8200, lng: 27.4300 }; // ~11 km west
const FAR2 = { lat: 54.0300, lng: 27.7000 }; // ~17 km north-east

// 1. car: three time-ordered, non-overlapping items with travel legs
{
  const events = [ev("a", A.lat, A.lng, [10]), ev("b", B.lat, B.lng, [13]), ev("c", C.lat, C.lng, [16])];
  const r = buildDayScenario(events, baseInput(), deps());
  assert.equal(r.status, "ok");
  assert.deepEqual(r.items.map((i) => i.activityId), ["a", "b", "c"]);
  assert.equal(r.items[0]!.travelFromPrev, null);
  assert.ok(r.items[1]!.travelFromPrev && r.items[1]!.travelFromPrev.mode === "car");
  assert.ok(r.items.every((i, k) => k === 0 || i.startsAtMs >= r.items[k - 1]!.endsAtMs));
}

// 2. busy interval and exclusions are respected
{
  const events = [ev("a", A.lat, A.lng, [10, 14]), ev("b", B.lat, B.lng, [10, 15]), ev("x", C.lat, C.lng, [12])];
  const r = buildDayScenario(events, baseInput({ busy: [{ startMs: at(9.5), endMs: at(11.5) }], excludeActivityIds: ["x"], targetCount: 2 }), deps());
  assert.ok(!r.items.some((i) => i.activityId === "x"), "excluded event never placed");
  assert.ok(r.items.every((i) => i.startsAtMs >= at(11.5) + 10 * 60_000 || i.endsAtMs <= at(9.5) - 10 * 60_000), "nothing overlaps the busy block");
}

// 3. pinned anchors are kept as-is
{
  const events = [ev("p", A.lat, A.lng, [12], 1), ev("b", B.lat, B.lng, [15], 99), ev("c", C.lat, C.lng, [10], 50)];
  const r = buildDayScenario(events, baseInput({ pinned: [{ activityId: "p", startsAtMs: at(12) }], targetCount: 2 }), deps());
  const pinned = r.items.find((i) => i.activityId === "p");
  assert.ok(pinned && pinned.pinned && pinned.startsAtMs === at(12));
  assert.equal(r.items.length, 2);
}

// 4. walk: only the tight cluster; far events excluded; fewer than target -> few_nearby + car hint
{
  const events = [ev("a", A.lat, A.lng, [10]), ev("b", B.lat, B.lng, [13]), ev("c", C.lat, C.lng, [16]), ev("far", FAR.lat, FAR.lng, [16], 14)];
  const r = buildDayScenario(events, baseInput({ mode: "walk", targetCount: 3 }), deps());
  assert.ok(!r.items.some((i) => i.activityId === "far"), "a lone best-scored event far away does not strand the walk");
  assert.equal(r.items.length, 3);
  assert.equal(r.status, "ok");
  const sparse = buildDayScenario([ev("a", A.lat, A.lng, [10]), ev("b", B.lat, B.lng, [13]), ev("far", FAR.lat, FAR.lng, [16], 14)], baseInput({ mode: "walk", targetCount: 3 }), deps());
  assert.equal(sparse.status, "few_nearby");
  assert.equal(sparse.suggestMode, "car");
  assert.ok(r.items.every((i) => (i.travelFromPrev?.minutes ?? 0) <= 15));
}

// 5. walk excludes approximate (metro) positions; car keeps them flagged
{
  const approx = ev("m", A.lat, A.lng, [10], 50, { geo: { ...geoCellsFor(A.lat, A.lng)!, lat: A.lat, lng: A.lng, approximate: true } });
  const walk = buildDayScenario([approx], baseInput({ mode: "walk", targetCount: 1 }), deps());
  assert.equal(walk.items.length, 0);
  const car = buildDayScenario([approx], baseInput({ mode: "car", targetCount: 1 }), deps());
  assert.equal(car.items[0]!.approximatePlace, true);
  const noGeo = buildDayScenario([ev("n", null, null, [10])], baseInput({ targetCount: 1 }), deps());
  assert.equal(noGeo.items.length, 0, "no coordinates at all never enters a scenario");
  assert.equal(noGeo.status, "empty");
}

// 6. toddler walking budget is 2 km, otherwise 3 km (4 venues in a row, ~0.7 km apart -> 2.1 km)
{
  const step = 0.01069; // ~0.7 km of longitude at 54N, inside one geoCell6 width
  const events = [0, 1, 2, 3].map((i) => ev(`p${i}`, 53.9, 27.55 + i * step, [10 + i * 2.5]));
  const adult = buildDayScenario(events, baseInput({ mode: "walk", targetCount: 4 }), deps());
  const toddler = buildDayScenario(events, baseInput({ mode: "walk", targetCount: 4, audience: { ageRanges: [], profileInterestSlugs: [], hasToddler: true } }), deps());
  assert.equal(adult.items.length, 4, "2.1 km fits the 3 km budget");
  assert.equal(toddler.items.length, 3, "2.1 km exceeds the 2 km toddler budget");
}

// 7. car: at most one transition between geoCell5 clusters per day
{
  const events = [ev("a", A.lat, A.lng, [10]), ev("far", FAR.lat, FAR.lng, [13]), ev("far2", FAR2.lat, FAR2.lng, [16])];
  const r = buildDayScenario(events, baseInput(), deps());
  const cells = r.items.map((i) => events.find((e) => e.activityId === i.activityId)!.geo!.geoCell5);
  const transitions = cells.filter((c, i) => i > 0 && c !== cells[i - 1]).length;
  assert.ok(transitions <= 1, `cell5 transitions ${transitions}`);
  assert.equal(r.items.length, 2);
}

// 8. far flag: a transfer above 40 minutes is marked
{
  const events = [ev("a", A.lat, A.lng, [10]), ev("far2", FAR2.lat, FAR2.lng, [14])];
  const r = buildDayScenario(events, baseInput({ targetCount: 2 }), deps());
  assert.equal(r.items.length, 2);
  assert.equal(r.items[1]!.far, travelLeg(events[0]!.geo!, events[1]!.geo!, "car").minutes > 40);
}

// 9. variants: stable for a seed, and some seed differs from the best build
{
  const events = Array.from({ length: 12 }, (_, i) => ev(`e${i}`, A.lat + i * 0.0008, A.lng, [10 + (i % 6) * 1.5], 10 + (i % 5)));
  const best1 = buildDayScenario(events, baseInput(), deps()).items.map((i) => i.activityId).join();
  const best2 = buildDayScenario(events, baseInput(), deps()).items.map((i) => i.activityId).join();
  assert.equal(best1, best2, "variant 0 is deterministic");
  const v3a = buildDayScenario(events, baseInput({ variant: 3 }), deps()).items.map((i) => i.activityId).join();
  const v3b = buildDayScenario(events, baseInput({ variant: 3 }), deps()).items.map((i) => i.activityId).join();
  assert.equal(v3a, v3b, "same seed gives the same variant");
  const others = [1, 2, 3, 4, 5, 6].map((v) => buildDayScenario(events, baseInput({ variant: v }), deps()).items.map((i) => i.activityId).join());
  assert.ok(others.some((o) => o !== best1), "some variant differs from the best build");
}

// 10. replace: keeps the others, never returns the replaced event
{
  const events = [ev("a", A.lat, A.lng, [10]), ev("b", B.lat, B.lng, [13]), ev("c", C.lat, C.lng, [16]), ev("d", C.lat + 0.001, C.lng, [16], 5)];
  const first = buildDayScenario(events, baseInput(), deps());
  const cur = first.items.map((i) => ({ activityId: i.activityId, startsAtMs: i.startsAtMs }));
  const victim = first.items[1]!.activityId;
  const r = replaceScenarioItem(events, baseInput(), cur, victim, deps());
  assert.ok(!r.items.some((i) => i.activityId === victim));
  for (const keep of cur.filter((c) => c.activityId !== victim)) {
    assert.ok(r.items.some((i) => i.activityId === keep.activityId && i.startsAtMs === keep.startsAtMs), `kept ${keep.activityId}`);
  }
}

// 11. age filter
{
  const events = [ev("kid", A.lat, A.lng, [10], 10, { ageTags: ["3-5"] }), ev("teen", B.lat, B.lng, [13], 10, { ageTags: ["12-14"] }), ev("any", C.lat, C.lng, [16], 10)];
  const r = buildDayScenario(events, baseInput({ audience: { ageRanges: ["3-5"], profileInterestSlugs: [], hasToddler: false } }), deps());
  assert.deepEqual(r.items.map((i) => i.activityId).sort(), ["any", "kid"]);
}

// 12. estimator memoises pairs and computes each once
{
  const est = new TravelEstimator();
  const ga = ev("a", A.lat, A.lng, [10]).geo!;
  const gb = ev("b", B.lat, B.lng, [13]).geo!;
  est.estimate("a", ga, "b", gb, "car");
  est.estimate("a", ga, "b", gb, "car");
  est.estimate("a", ga, "b", gb, "walk");
  assert.deepEqual(est.stats(), { entries: 2, computed: 2 });
}

// 13. walk speed model: ~1.2 km is about 15 minutes
{
  const leg = travelLeg(ev("a", 53.9, 27.55, [10]).geo!, ev("b", 53.9108, 27.55, [10]).geo!, "walk");
  assert.ok(leg.minutes >= 14 && leg.minutes <= 16, `walk 1.2 km -> ${leg.minutes} min`);
}

// ---------- filler places ----------
function place(id: string, lat: number, lng: number, availability: PoolEvent["availability"], over: Partial<PoolEvent> = {}): PoolEvent {
  return {
    ...ev(id, lat, lng, [], 0),
    kind: "place",
    availability,
    uncategorized: false,
    sessionStartsMs: [],
    durationMin: 90,
    ...over,
  };
}
const ALWAYS = { kind: "always" } as const;
const UNKNOWN = { kind: "unknown" } as const;

// F1. an event stays the anchor; fillers complete the day; ordered, non-overlapping
{
  const events = [ev("e", A.lat, A.lng, [12]), place("p1", B.lat, B.lng, ALWAYS), place("p2", C.lat, C.lng, ALWAYS)];
  const r = buildDayScenario(events, baseInput(), deps());
  assert.equal(r.items.length, 3);
  assert.ok(r.items.some((i) => i.activityId === "e" && i.kind === "event"));
  assert.equal(r.items.filter((i) => i.kind === "place").length, 2);
  assert.ok(r.items.every((i, k) => k === 0 || i.startsAtMs >= r.items[k - 1]!.endsAtMs));
  assert.ok(r.items.filter((i) => i.kind === "place").every((i) => i.startsAtMs % (30 * 60_000) === 0), "filler starts sit on the 30-minute grid");
}

// F2. opening windows are respected (open 10:00-12:00 with a 90 minute visit -> starts 10:00..10:30)
{
  const w: PoolEvent["availability"] = { kind: "windows", windows: [{ startMs: at(10), endMs: at(12) }] };
  const r = buildDayScenario([place("p", A.lat, A.lng, w)], baseInput({ targetCount: 1 }), deps());
  assert.equal(r.items.length, 1);
  assert.ok(r.items[0]!.startsAtMs >= at(10) && r.items[0]!.endsAtMs <= at(12), "inside the opening window");
  const outside: PoolEvent["availability"] = { kind: "windows", windows: [{ startMs: at(5), endMs: at(8) }] };
  assert.equal(buildDayScenario([place("p", A.lat, A.lng, outside)], baseInput({ targetCount: 1 }), deps()).items.length, 0, "open only before the planning window -> not offered");
  const tooShort: PoolEvent["availability"] = { kind: "windows", windows: [{ startMs: at(10), endMs: at(11) }] };
  assert.equal(buildDayScenario([place("p", A.lat, A.lng, tooShort)], baseInput({ targetCount: 1 }), deps()).items.length, 0, "window shorter than the visit -> not offered");
  const shortVisit = buildDayScenario([place("p", A.lat, A.lng, tooShort, { durationMin: 60 })], baseInput({ targetCount: 1 }), deps());
  assert.equal(shortVisit.items.length, 1, "a 60 minute cafe visit fits a one hour window");
}

// F3. unknown hours: allowed, flagged, and ranked below a place with confirmed hours
{
  const lone = buildDayScenario([place("u", A.lat, A.lng, UNKNOWN)], baseInput({ targetCount: 1 }), deps());
  assert.equal(lone.items.length, 1, "without a hours record the place is still offered (otherwise the pool is empty)");
  assert.equal(lone.items[0]!.hoursUnconfirmed, true);
  const both = buildDayScenario([place("u", A.lat, A.lng, UNKNOWN), place("k", A.lat + 0.0001, A.lng, ALWAYS)], baseInput({ targetCount: 1 }), deps());
  assert.equal(both.items[0]!.activityId, "k", "confirmed hours win over unknown hours");
  assert.equal(both.items[0]!.hoursUnconfirmed, false);
}

// F4. uncategorized places: allowed, but at most one per scenario
{
  const three = [0, 1, 2].map((i) => place(`n${i}`, A.lat + i * 0.001, A.lng, ALWAYS, { uncategorized: true }));
  assert.equal(buildDayScenario(three, baseInput(), deps()).items.length, 1, "only uncategorized places -> exactly one");
  const mixed = [...three, place("c1", C.lat, C.lng, ALWAYS), place("c2", C.lat + 0.001, C.lng, ALWAYS)];
  const r = buildDayScenario(mixed, baseInput(), deps());
  assert.equal(r.items.filter((i) => mixed.find((m) => m.activityId === i.activityId)!.uncategorized).length <= 1, true);
  assert.equal(r.items.length, 3);
  // a pinned uncategorized place counts against the limit
  const pinned = buildDayScenario(three, baseInput({ pinned: [{ activityId: "n0", startsAtMs: at(11) }], targetCount: 3 }), deps());
  assert.deepEqual(pinned.items.map((i) => i.activityId), ["n0"], "pinned uncategorized place uses the single slot");
}

// F5. walk mode works with fillers inside the walking ring, and respects the ring
{
  const near = [place("w1", A.lat, A.lng, ALWAYS), place("w2", B.lat, B.lng, ALWAYS), place("wfar", FAR.lat, FAR.lng, ALWAYS)];
  const r = buildDayScenario(near, baseInput({ mode: "walk", targetCount: 3 }), deps());
  assert.ok(!r.items.some((i) => i.activityId === "wfar"));
  assert.equal(r.items.length, 2);
  assert.ok(r.items.every((i) => (i.travelFromPrev?.minutes ?? 0) <= 15));
}

// F6. an event always beats a filler of equal proximity, even with zero engagement
{
  const r = buildDayScenario([place("p", A.lat, A.lng, ALWAYS), ev("zero", A.lat + 0.0001, A.lng, [12], 0)], baseInput({ targetCount: 1 }), deps());
  assert.equal(r.items[0]!.activityId, "zero");
}

// F7. place age restrictions are enforced like event ones (review finding)
{
  const child = { ageRanges: ["3-5"], profileInterestSlugs: [], hasToddler: false };
  const places = [
    place("adults", A.lat, A.lng, ALWAYS, { adultOnly: true }),
    place("teens", B.lat, B.lng, ALWAYS, { ageTags: ["12-14"] }),
    place("kids", C.lat, C.lng, ALWAYS, { ageTags: ["3-5"] }),
    place("any", A.lat + 0.0005, A.lng, ALWAYS),
  ];
  const r = buildDayScenario(places, baseInput({ audience: child }), deps());
  assert.deepEqual(r.items.map((i) => i.activityId).sort(), ["any", "kids"], "adults-only and non-matching age places never reach a child scenario");
  const adultsOk = buildDayScenario(places, baseInput({ audience: { ageRanges: ["18+"], profileInterestSlugs: [], hasToddler: false } }), deps());
  assert.ok(adultsOk.items.some((i) => i.activityId === "adults"), "an adult audience may get the adults-only place");
}

// F8. virtual-session events (time from the schedule rules) rank below confirmed ones and are flagged
{
  const confirmed = ev("confirmed", A.lat, A.lng, [10], 10);
  const virtual = ev("virtual", B.lat, B.lng, [10], 10, { virtualSession: true });
  const both = buildDayScenario([confirmed, virtual], baseInput({ targetCount: 1 }), deps());
  assert.deepEqual(both.items.map((i) => i.activityId), ["confirmed"], "same score: the confirmed session wins");
  assert.equal(both.items[0]!.scheduleUnconfirmed, false);
  const alone = buildDayScenario([virtual], baseInput({ targetCount: 1 }), deps());
  assert.equal(alone.items[0]!.activityId, "virtual", "a virtual event is still offered when nothing confirmed fits");
  assert.equal(alone.items[0]!.scheduleUnconfirmed, true, "and is flagged so the UI can say the time is by schedule");
  assert.equal(alone.items[0]!.hoursUnconfirmed, false);
  const a = buildDayScenario([ev("c1", A.lat, A.lng, [10], 10), virtual], baseInput({ variant: 0 }), deps());
  assert.ok(a.items.every((i) => i.startsAtMs >= at(9) && i.endsAtMs <= at(20)), "a virtual start obeys the same window and overlap rules");
}

console.log("dayScenario build tests passed");
