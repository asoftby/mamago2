import assert from "node:assert/strict";
import { geoCellsFor } from "../../../src/lib/geo/geoCell";
import { haversineMeters } from "../../../src/lib/geo/haversineMeters";
import { CLUSTER_LABEL, MOCK_PLACES, type ClusterKey } from "./places.data";
import { MOCK_EVENTS, DAY_SLOTS } from "./events.data";
import {
  buildPlanLines,
  eventSlug,
  hoursPlanFor,
  placeSlug,
  refusalReason,
  resolveSlotDates,
  sessionInstant,
} from "../seed-day-scenario-mocks";

// ---- cluster sizes follow the agreed plan (places / events)
const centres: Record<ClusterKey, [number, number]> = {
  center: [53.9015, 27.559], uruche: [53.9457, 27.6901], kamgorka: [53.9081, 27.4363], serebr: [53.851, 27.617], bor: [53.9965, 27.6731], zhd: [53.9471, 27.4263],
};
const placeCount = (k: ClusterKey) => MOCK_PLACES.filter((p) => p.cluster === k && p.lat != null).length;
assert.deepEqual([placeCount("center"), placeCount("uruche"), placeCount("kamgorka"), placeCount("serebr")], [15, 8, 8, 6]);
assert.equal(placeCount("bor") + placeCount("zhd"), 4, "suburb: ~4 places");
const eventCount = (...k: ClusterKey[]) => MOCK_EVENTS.filter((e) => k.includes(e.cluster) && e.mode !== "RECURRING").length;
assert.deepEqual([eventCount("center"), eventCount("uruche"), eventCount("kamgorka"), eventCount("serebr"), eventCount("bor", "zhd")], [6, 3, 3, 2, 1]);

// ---- keys/slugs unique, titles marked, event places exist
assert.equal(new Set(MOCK_PLACES.map((p) => p.key)).size, MOCK_PLACES.length);
assert.equal(new Set(MOCK_EVENTS.map((e) => e.key)).size, MOCK_EVENTS.length);
assert.ok(MOCK_PLACES.every((p) => p.title.startsWith("[MOCK]") && placeSlug(p.key).startsWith("mock-dsm-")));
assert.ok(MOCK_EVENTS.every((e) => e.title.startsWith("[MOCK]") && eventSlug(e.key).startsWith("mock-dsm-")));
const keys = new Set(MOCK_PLACES.map((p) => p.key));
for (const e of MOCK_EVENTS) if (e.placeKey) assert.ok(keys.has(e.placeKey), `event ${e.key} -> ${e.placeKey}`);

// ---- geography: real coordinates sit inside their cluster, distinct clusters are far apart
for (const p of MOCK_PLACES) {
  if (p.lat == null || p.lng == null) continue;
  const [lat, lng] = centres[p.cluster];
  const d = haversineMeters(lat, lng, p.lat, p.lng);
  assert.ok(d <= 3500, `${p.key} is ${Math.round(d)} m from its cluster centre`);
  assert.ok(geoCellsFor(p.lat, p.lng), `${p.key} has usable coordinates`);
}
assert.ok(haversineMeters(...centres.center, ...centres.kamgorka) > 5000 && haversineMeters(...centres.center, ...centres.uruche) > 5000);
// distinct coordinates (>= 60 m apart) so cells/ordering are meaningful
const pts = MOCK_PLACES.filter((p) => p.lat != null);
for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
  assert.ok(haversineMeters(pts[i]!.lat!, pts[i]!.lng!, pts[j]!.lat!, pts[j]!.lng!) >= 50, `${pts[i]!.key} / ${pts[j]!.key} too close`);
}

// ---- coverage the matrix needs: categories, ages, every hours variant, adults-only
const cats = new Set(MOCK_PLACES.map((p) => p.category));
for (const c of ["ent", "play", "museum", "park", "sport", "creative", "food"]) assert.ok(cats.has(c as never), `category ${c}`);
const ages = new Set(MOCK_PLACES.flatMap((p) => p.ages));
for (const a of ["0-1", "1-3", "3-5", "5-7", "7-9", "9-12", "12-14"]) assert.ok(ages.has(a), `age ${a}`);
assert.ok(MOCK_PLACES.some((p) => p.ages.length === 0 && !p.adultOnly), "an unrestricted place");
assert.ok(MOCK_PLACES.some((p) => p.adultOnly), "an adults-only place");
const hours = new Set(MOCK_PLACES.map((p) => p.hours));
for (const h of ["weekly", "exception", "always", "appointment", "temp-closed", "none", "monday-off"]) assert.ok(hours.has(h as never), `hours variant ${h}`);

// ---- events: special cases requested for the matrix
assert.ok(MOCK_EVENTS.some((e) => e.placeKey === null && e.metroLike), "event without a place (metro only)");
assert.ok(MOCK_EVENTS.some((e) => e.placeKey === "center-nocoords-1") && MOCK_PLACES.find((p) => p.key === "center-nocoords-1")!.lat === null, "event with a place without coordinates");
const recurring = MOCK_EVENTS.find((e) => e.mode === "RECURRING");
assert.ok(recurring && DAY_SLOTS.every((s) => !recurring.sessions[s]?.length), "RECURRING without any session");
const start = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const sat1 = MOCK_EVENTS.flatMap((e) => (e.sessions.sat1 ?? []).map((t) => ({ k: e.key, m: start(t) })));
assert.ok(sat1.some((a, i) => sat1.some((b, j) => i !== j && Math.abs(a.m - b.m) < 90)), "sessions overlap in time");
const allTimes = MOCK_EVENTS.flatMap((e) => DAY_SLOTS.flatMap((s) => e.sessions[s] ?? []));
assert.ok(allTimes.some((t) => start(t) < 11 * 60) && allTimes.some((t) => start(t) >= 12 * 60 && start(t) < 17 * 60) && allTimes.some((t) => start(t) >= 17 * 60), "morning, day and evening starts");
for (const slot of ["sat1", "sun1", "sat2", "sun2", "wed1"] as const) assert.ok(MOCK_EVENTS.some((e) => e.sessions[slot]?.length), `slot ${slot} used`);

// ---- date calculus is relative to the apply date (Minsk), strictly in the future
const d = resolveSlotDates("2026-11-07"); // a Saturday
assert.deepEqual(d, { sat1: "2026-11-14", sun1: "2026-11-15", sat2: "2026-11-21", sun2: "2026-11-22", wed1: "2026-11-11" });
assert.deepEqual(resolveSlotDates("2026-11-08").sat1, "2026-11-14");
assert.equal(sessionInstant("2026-11-14", "10:00").toISOString(), "2026-11-14T07:00:00.000Z", "Minsk is UTC+3");

// ---- hours plans
const byVariant = (v: string) => MOCK_PLACES.find((p) => p.hours === v)!;
assert.deepEqual(hoursPlanFor(byVariant("monday-off"), d, 0), { kind: "weekly", mondayOff: true, exception: null });
assert.deepEqual(hoursPlanFor(byVariant("always"), d, 0), { kind: "mode", mode: "ALWAYS_OPEN" });
assert.deepEqual(hoursPlanFor(byVariant("none"), d, 0), { kind: "none" });
assert.deepEqual(hoursPlanFor(byVariant("exception"), d, 0), { kind: "weekly", mondayOff: false, exception: { date: d.sat1, closed: true } });
assert.deepEqual(hoursPlanFor(byVariant("exception"), d, 1), { kind: "weekly", mondayOff: false, exception: { date: d.sun1, closed: false } });

// ---- guards: DEV only, remote DB needs the matching host
const dbUrl = "postgresql://u:p@dev-db.internal:5432/x";
assert.match(refusalReason({ APP_ENV: "production", DATABASE_URL: dbUrl }, "dev-db.internal") ?? "", /DEV-only/);
assert.match(refusalReason({ DATABASE_URL: dbUrl }, "dev-db.internal") ?? "", /APP_ENV/);
assert.match(refusalReason({ APP_ENV: "dev", DATABASE_URL: dbUrl }, null) ?? "", /confirm-host/);
assert.match(refusalReason({ APP_ENV: "dev", DATABASE_URL: dbUrl }, "other") ?? "", /confirm-host/);
assert.equal(refusalReason({ APP_ENV: "dev", DATABASE_URL: dbUrl }, "dev-db.internal"), null);
assert.equal(refusalReason({ APP_ENV: "local", DATABASE_URL: "postgresql://u:p@localhost:5434/x" }, null), null);
assert.match(refusalReason({ APP_ENV: "dev" }, null) ?? "", /DATABASE_URL/);

// ---- plan output is complete
const lines = buildPlanLines("2026-11-07");
assert.ok(lines.length > MOCK_PLACES.length + MOCK_EVENTS.length);
assert.ok(CLUSTER_LABEL.center && lines.some((l) => l.includes("no ActivitySession")));

console.log("day-scenario mock catalog tests passed");
