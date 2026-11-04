import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { homeCatalogHref, homeSelection, homeChildrenYoungestFirst, homeAgeLabel, homePeriodLabel, minskPlanDate, familyHomeCacheKey, type HomeFamilyContext } from "./familyHome";
import { FamilyHomeCache, HOME_DISMISS_TTL_MS, drainPendingHomeDismissals, readHomeDismissals, writeHomeDismissals, type HomeDismissal } from "./familyHomeCache";
import { parseAppliedFromUrl } from "@/features/filters/discovery/discoveryFilterParams";

const context: HomeFamilyContext = { actorId: "account_a", signature: "a".repeat(64), day: "2030-11-02", policyVersion: "v2", audience: "personalized",
  selectedChildId: null, preferenceVersion: null, selectionPersistence: "account",
  children: [{ id: "child_0001", name: "А", hasBirthDate: true, ageFilter: ["3-5"] }, { id: "child_0002", name: "Б", hasBirthDate: true, ageFilter: ["9-12"] }] };
function delivery(ids = ["event_a", "event_b"]) { return { items: ids.map(id => ({ id })), window: { horizonDays: 7 as const }, runId: "same_run" }; }

test("personal rolling windows are labeled precisely, not as a calendar week", () => {
  assert.equal(homePeriodLabel({ horizonDays: 7, dateFrom: "2026-11-04", dateTo: "2026-11-10" }), "На ближайшие 7 дней");
  assert.equal(homePeriodLabel({ horizonDays: 30, dateFrom: "2026-11-04", dateTo: "2026-12-03" }), "На ближайшие 30 дней");
});

test("child chips are sorted youngest first, unknown DOB last, without mutating source order", () => {
  const children = [
    { id: "old", name: "Тая", hasBirthDate: true, ageMonths: 99, ageFilter: [] },
    { id: "unknown", name: "Без даты", hasBirthDate: false, ageMonths: null, ageFilter: [] },
    { id: "young", name: "Степан", hasBirthDate: true, ageMonths: 48, ageFilter: [] },
  ];
  assert.deepEqual(homeChildrenYoungestFirst({ ...context, children }).map(child => child.id), ["young", "old", "unknown"]);
  assert.equal(children[0].id, "old");
});

test("catalog is explicit canonical OR, round trips; no identity in URL", () => {
  for (const selected of [null, "child_0001", "child_0002"]) {
    const href = homeCatalogHref("minsk", context, selected);
    const params = new URL(href, "https://example.invalid").searchParams;
    assert.deepEqual(parseAppliedFromUrl(params).age, selected === null ? ["3-5", "9-12"] : selected === "child_0001" ? ["3-5"] : ["9-12"]);
    assert.ok(!/child|kids|profile|account/.test(href));
  }
  assert.equal(homeSelection(context, "deleted_child"), null);
});

test("full age ranges and Minsk plan date", () => {
  assert.equal(homeAgeLabel({ agePolicy: "SPECIFIC", ageMinMonths: 36, ageMaxMonths: 168 }), "3–14");
  assert.equal(homeAgeLabel({ agePolicy: "SPECIFIC", ageMinMonths: 36, ageMaxMonths: null }), "3+");
  assert.equal(minskPlanDate("2030-11-02T22:30:00Z"), "2030-11-03");
});

test("cache key includes actor, profile/membership signature, city, selection, version, day and horizon", () => {
  const base = familyHomeCacheKey(context, "minsk", null, 7);
  for (const change of [{ actorId: "account_b" }, { signature: "new_family" }, { policyVersion: "v3" }, { day: "2030-11-03" }]) assert.notEqual(familyHomeCacheKey({ ...context, ...change }, "minsk", null, 7), base);
  assert.notEqual(familyHomeCacheKey(context, "grodno", null, 7), base);
  assert.notEqual(familyHomeCacheKey(context, "minsk", "child_0001", 7), base);
  assert.notEqual(familyHomeCacheKey(context, "minsk", null, 30), base);
});

test("cache hits retain run; no cross-account, TTL or profile leak", () => {
  const cache = new FamilyHomeCache<ReturnType<typeof delivery>>("account_a");
  cache.set(context, "minsk", null, delivery(), 100);
  assert.equal(cache.get(context, "minsk", null, 200)?.runId, "same_run");
  assert.equal(cache.get({ ...context, signature: "new" }, "minsk", null, 200), null);
  assert.equal(cache.get(context, "minsk", null, 120101), null);
  cache.set(context, "minsk", null, delivery());
  assert.equal(cache.get({ ...context, actorId: "account_b" }, "minsk", null), null);
  assert.equal(cache.get(context, "minsk", null), null, "wrong actor cancels all prior entries");
});

test("expired occurrence invalidates cache before the ordinary TTL", () => {
  const cache = new FamilyHomeCache<{ items: { id: string; startsAt: string }[]; window: { horizonDays: 7 } }>("account_a");
  cache.set(context, "minsk", null, { items: [{ id: "a", startsAt: new Date(1000).toISOString() }], window: { horizonDays: 7 } }, 500);
  assert.equal(cache.get(context, "minsk", null, 1001), null);
});

test("generation guards reject old promises on rapid selection/city/actor changes", async () => {
  const cache = new FamilyHomeCache<ReturnType<typeof delivery>>("account_a");
  const old = cache.begin();
  const current = cache.begin();
  await Promise.resolve();
  assert.equal(cache.current(old), false);
  assert.equal(cache.current(current), true);
  cache.cancel();
  assert.equal(cache.current(current), false);
});

test("dismiss removes every chip and refetch cannot resurrect, independent of POST success", () => {
  const cache = new FamilyHomeCache<ReturnType<typeof delivery>>("account_a");
  for (const choice of [null, "child_0001", "child_0002"]) cache.set(context, "minsk", choice, delivery());
  cache.dismiss("event_a");
  for (const choice of [null, "child_0001", "child_0002"]) {
    cache.set(context, "minsk", choice, delivery());
    assert.deepEqual(cache.get(context, "minsk", choice)?.items, [{ id: "event_b" }]);
  }
});

test("child-scoped dismissal does not affect other children or the whole-family feed", () => {
  const cache = new FamilyHomeCache<ReturnType<typeof delivery>>("account_a");
  for (const choice of [null, "child_0001", "child_0002"]) cache.set(context, "minsk", choice, delivery());
  cache.dismiss("event_a", Date.now() + HOME_DISMISS_TTL_MS, "child_0001");
  // A dismissal invalidates stale cache entries; fresh response must still be filtered.
  for (const choice of [null, "child_0001", "child_0002"]) cache.set(context, "minsk", choice, delivery());
  assert.deepEqual(cache.get(context, "minsk", "child_0001")?.items, [{ id: "event_b" }]);
  assert.equal(cache.get(context, "minsk", "child_0002")?.items.length, 2);
  assert.equal(cache.get(context, "minsk", null)?.items.length, 2);
  // Same event can be rejected separately for a second child.
  cache.dismiss("event_a", Date.now() + HOME_DISMISS_TTL_MS, "child_0002");
  for (const choice of [null, "child_0001", "child_0002"]) cache.set(context, "minsk", choice, delivery());
  assert.deepEqual(cache.get(context, "minsk", "child_0002")?.items, [{ id: "event_b" }]);
  assert.equal(cache.get(context, "minsk", null)?.items.length, 2);
});

test("device dismissal storage is account-scoped, bounded and aligned with server 60-day TTL", () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
  try {
    const now = Date.now();
    writeHomeDismissals("account_a", [{ id: "event_a", token: "dismiss_0001", at: now, city: "minsk", exposureId: null, saved: false }]);
    assert.equal(readHomeDismissals("account_a", now).length, 1);
    assert.equal(readHomeDismissals("account_b", now).length, 0);
    assert.equal(readHomeDismissals("account_a", now + HOME_DISMISS_TTL_MS + 1).length, 0);
    storage.set("mg_family_picks_dismissed", '["event_b"]');
    assert.deepEqual(readHomeDismissals("account_b"), []);
  } finally { Reflect.deleteProperty(globalThis, "localStorage"); }
});

test("failed or deleted-child dismissals cannot block valid entries or cause retry loops", async () => {
  const entry = (token: string, child: string | null): HomeDismissal =>
    ({ id: token, token, city: "minsk", exposureId: null, selectedChildId: child, at: Date.now(), saved: false });
  const records = [entry("orphan", "deleted_child"), entry("valid", "child_0001"), entry("network", null)];
  const attempts: string[] = [];
  let failures = 0;
  let writes = 0;
  const flush = () => drainPendingHomeDismissals(
    () => records, () => true,
    async record => {
      attempts.push(record.token);
      if (record.token === "orphan" || (record.token === "network" && failures < 2)) {
        throw new Error(record.token === "orphan" ? "home_404" : "home_503");
      }
    },
    () => { writes++; },
    () => { failures++; },
  );
  await flush();
  assert.deepEqual(attempts, ["orphan", "valid", "network"]);
  assert.deepEqual(records.map(record => record.saved), [false, true, false]);
  assert.equal(writes, 1);
  await flush();
  assert.deepEqual(attempts, ["orphan", "valid", "network", "orphan", "network"]);
  assert.deepEqual(records.map(record => record.saved), [false, true, true]);
  assert.equal(writes, 2);
});

test("newly queued dismissals are sent while an earlier write is pending", async () => {
  const records: HomeDismissal[] = [{ id: "first", token: "first", city: "minsk", exposureId: null, at: Date.now(), saved: false }];
  const attempts: string[] = [];
  await drainPendingHomeDismissals(
    () => records, () => true,
    async record => {
      attempts.push(record.token);
      if (record.token === "first") records.push({ id: "second", token: "second", city: "minsk", exposureId: null, at: Date.now(), saved: false });
    },
    () => {},
    () => assert.fail("no write should fail"),
  );
  assert.deepEqual(attempts, ["first", "second"]);
  assert.ok(records.every(record => record.saved));
});

test("UI contract: one save control, poster, keyboard/ARIA, error and 7/30 empty states", () => {
  const ui = readFileSync("src/features/city-home/components/CityHomeFamilyPicks.tsx", "utf8");
  assert.ok(ui.includes("homeRecommendationLabel"));
  assert.doesNotMatch(ui, /Не удалось обновить\. Повторить/, "failed background refresh must not add a technical CTA below loaded cards");
  assert.doesNotMatch(ui, /Не удалось загрузить события\. Повторите попытку\./, "initial load errors use a poster-size card instead of a technical message");
  assert.match(ui, /state === "error" && !data[\s\S]*?<HomeMoreEventsCard href=\{catalogHref\} hasEvents=\{false\}/, "initial failure renders the same empty event-card component");

  assert.ok(ui.includes("hasCatalogEvents"));
  assert.ok(!ui.includes("homeChipSelectEvent"));
  assert.ok(ui.includes("stored.filter(entry => entry.selectedChildId == null)"));
  assert.ok(ui.includes("Date.now() - lastCheckedAt.current < 60_000"));
  assert.ok(ui.includes("visibilitychange"));
  const page = readFileSync("src/features/city-home/pages/CityHomePage.tsx", "utf8");
  assert.doesNotMatch(page, /CityHomeKudaSection|getKudaDiscoveryFeed|hasHomeContent|kudaPreviewPromise/);
  assert.match(page, /events.mode === "personal"/);
  assert.ok(page.indexOf("<StoriesSection cityId=") < page.indexOf('events.mode === "error"'),
    "stories must precede both public and personalized afisha");
  const general = readFileSync("src/features/city-home/components/CityHomeGeneralEvents.tsx", "utf8");
  assert.match(general, /authenticated=|События, которые подходят вашей семье/);
  assert.doesNotMatch(general, /AGE_GROUPS|age_discovery_unavailable|\/api\/discovery\/events\/page/,
    "guest must not launch a second discovery request for age filters");
  assert.match(general, /useFamilyPersona/, "authenticated non-personalized users still honor global header selection");
  assert.doesNotMatch(general, /useDiscoveryFilters|\/api\/discovery\/events\/page/);
});
