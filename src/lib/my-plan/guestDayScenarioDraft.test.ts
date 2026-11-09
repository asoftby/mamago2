import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { DraftItem } from "@/features/my-plan/lib/dayScenarioUi/model";
import { applyGuestDayScenarioAfterAuth, GUEST_DAY_SCENARIO_DRAFT_KEY, GUEST_DAY_SCENARIO_DRAFT_TTL_MS, parseGuestDayScenarioDraft, writeGuestDayScenarioDraft } from "./guestDayScenarioDraft";

const NOW = Date.parse("2026-11-09T10:00:00Z");
const item = (id: string, over: Partial<DraftItem> = {}): DraftItem => ({
  kind: "event", hoursUnconfirmed: false, scheduleUnconfirmed: false, activityId: id,
  card: { id, slug: id, title: id, coverImageUrl: null, ageLabel: null, categoryName: null, priceFrom: null, priceTo: null, priceText: null, currency: null, address: null },
  startsAt: "2026-11-14T08:00:00.000Z", endsAt: "2026-11-14T09:30:00.000Z", pinned: false, travel: null, approximatePlace: false, far: false, ...over,
});
function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { api: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) }, data };
}
const res = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function run() {
  // ---- writing
  const mem = memory();
  assert.equal(writeGuestDayScenarioDraft([{ date: "2026-11-14", items: [item("a"), item("b", { kind: "place" })] }, { date: "2026-11-15", items: [] }], mem.api, NOW, "gd-key-0001"), true);
  const stored = parseGuestDayScenarioDraft(mem.data.get(GUEST_DAY_SCENARIO_DRAFT_KEY)!, NOW)!;
  assert.deepEqual(stored.body.days.map((d) => [d.date, d.items.map((i) => i.activityId)]), [["2026-11-14", ["a", "b"]]], "an empty day is not stored; items in time order");
  assert.equal(stored.idempotencyKey, "gd-key-0001");
  assert.deepEqual(Object.keys(stored.body.days[0]!.items[0]!).sort(), ["activityId", "endsAt", "kind", "pinned", "startsAt", "travel"], "only what the save needs: no cards, no names");
  assert.equal(writeGuestDayScenarioDraft([{ date: "2026-11-14", items: [] }], mem.api, NOW, "gd-key-0002"), false, "nothing to keep");
  assert.equal(writeGuestDayScenarioDraft([{ date: "2026-11-14", items: [item("a")] }], null, NOW, "gd-key-0003"), false, "no storage: the caller says so");
  assert.equal(writeGuestDayScenarioDraft([{ date: "2026-11-14", items: [item("a")] }], { ...mem.api, setItem: () => { throw new Error("quota"); } }, NOW, "gd-key-0004"), false, "a full or blocked storage is not a crash");

  // ---- reading: only what this version wrote, and not too old
  const raw = mem.data.get(GUEST_DAY_SCENARIO_DRAFT_KEY)!;
  assert.ok(parseGuestDayScenarioDraft(raw, NOW + GUEST_DAY_SCENARIO_DRAFT_TTL_MS - 1000));
  assert.equal(parseGuestDayScenarioDraft(raw, NOW + GUEST_DAY_SCENARIO_DRAFT_TTL_MS + 1000), null, "older than a day");
  assert.equal(parseGuestDayScenarioDraft(raw, NOW - 3_600_000), null, "from the future");
  for (const bad of [null, "", "not json", "{}", JSON.stringify({ v: 2 }), JSON.stringify({ v: 1, savedAt: NOW, idempotencyKey: "x", body: {} }), JSON.stringify({ v: 1, savedAt: NOW, idempotencyKey: "gd-key-0001", body: { days: [{ date: "14-11", items: [] }] } }), JSON.stringify({ v: 1, savedAt: NOW, idempotencyKey: "gd-key-0001", body: { days: [{ date: "2026-11-14", items: [{ kind: "x", activityId: "a", startsAt: "s", endsAt: "e" }] }] } })]) {
    assert.equal(parseGuestDayScenarioDraft(bad as string | null, NOW), null, String(bad).slice(0, 40));
  }

  // ---- applying after auth
  {
    const m = memory({ [GUEST_DAY_SCENARIO_DRAFT_KEY]: raw });
    const seen: { url: string; key: string | null; body: string }[] = [];
    const out = await applyGuestDayScenarioAfterAuth(m.api, async (url, init) => {
      seen.push({ url: String(url), key: new Headers(init?.headers).get("Idempotency-Key"), body: String(init?.body) });
      return res(200, { groupId: null, days: [] });
    }, NOW);
    assert.deepEqual(out, { kind: "saved", dates: ["2026-11-14"] });
    assert.deepEqual([seen[0]!.url, seen[0]!.key], ["/api/plan/day-scenario/save", "gd-key-0001"], "one save with the stored key");
    assert.equal(m.data.has(GUEST_DAY_SCENARIO_DRAFT_KEY), false, "forgotten after it is saved");
    assert.deepEqual(await applyGuestDayScenarioAfterAuth(m.api, async () => res(200), NOW), { kind: "none" }, "nothing waits any more: no second save");
  }
  {
    const m = memory({ [GUEST_DAY_SCENARIO_DRAFT_KEY]: raw });
    const out = await applyGuestDayScenarioAfterAuth(m.api, async () => res(409, { code: "DUPLICATE_PLACE" }), NOW);
    assert.equal(out.kind, "rejected");
    assert.match((out as { message: string }).message, /уже есть в вашем плане/, "told why");
    assert.equal(m.data.has(GUEST_DAY_SCENARIO_DRAFT_KEY), false, "a clash will not pass by itself: dropped");
  }
  for (const [status, code] of [[500, "INTERNAL_ERROR"], [429, "RATE_LIMITED"], [401, "UNAUTHENTICATED"]] as const) {
    const m = memory({ [GUEST_DAY_SCENARIO_DRAFT_KEY]: raw });
    assert.deepEqual(await applyGuestDayScenarioAfterAuth(m.api, async () => res(status, { code }), NOW), { kind: "retry" }, `${status} may pass`);
    assert.equal(m.data.has(GUEST_DAY_SCENARIO_DRAFT_KEY), true, "the draft stays");
  }
  {
    const m = memory({ [GUEST_DAY_SCENARIO_DRAFT_KEY]: raw });
    assert.deepEqual(await applyGuestDayScenarioAfterAuth(m.api, async () => { throw new TypeError("offline"); }, NOW), { kind: "retry" }, "offline: kept");
    assert.equal(m.data.has(GUEST_DAY_SCENARIO_DRAFT_KEY), true);
  }
  {
    const m = memory({ [GUEST_DAY_SCENARIO_DRAFT_KEY]: raw });
    let calls = 0;
    const slow = async () => { calls++; await new Promise((r) => setTimeout(r, 10)); return res(200); };
    const [a, b] = await Promise.all([applyGuestDayScenarioAfterAuth(m.api, slow, NOW), applyGuestDayScenarioAfterAuth(m.api, slow, NOW)]);
    assert.equal(calls, 1, "two runs at once make one request");
    assert.deepEqual(a, b);
  }
  {
    const m = memory({ [GUEST_DAY_SCENARIO_DRAFT_KEY]: "garbage" });
    assert.deepEqual(await applyGuestDayScenarioAfterAuth(m.api, async () => res(200), NOW), { kind: "none" });
    assert.equal(m.data.has(GUEST_DAY_SCENARIO_DRAFT_KEY), false, "a foreign or stale value never lingers");
    const none = memory();
    assert.deepEqual(await applyGuestDayScenarioAfterAuth(none.api, async () => res(200), NOW), { kind: "none" });
    assert.deepEqual(await applyGuestDayScenarioAfterAuth(null, async () => res(200), NOW), { kind: "none" }, "no storage");
  }
  {
    // a newer draft written while the request ran is not erased
    const m = memory({ [GUEST_DAY_SCENARIO_DRAFT_KEY]: raw });
    await applyGuestDayScenarioAfterAuth(m.api, async () => { m.data.set(GUEST_DAY_SCENARIO_DRAFT_KEY, "newer"); return res(200); }, NOW);
    assert.equal(m.data.get(GUEST_DAY_SCENARIO_DRAFT_KEY), "newer");
  }

  // ---- contracts
  const pipeline = readFileSync("src/lib/post-auth/pipeline.ts", "utf8");
  assert.match(pipeline, /await migrateGuestMyPlanAfterAuth\(\)[\s\S]*await applyGuestDayScenarioAfterAuth\(\)[\s\S]*executePipelinePendingAction/, "the guest's day is saved right after the old guest plan, before the pending action");
  const screen = readFileSync("src/features/my-plan/components/dayScenario/DayScenarioScreen.tsx", "utf8");
  assert.match(screen, /writeGuestDayScenarioDraft\(guestSaveDays[\s\S]*window\.location\.assign\(buildAuthUrl\(\{ redirectTo: appendMyPlanOpenToHref\(here\) \}\)\)/, "a guest's save stores the day, then goes to sign-in and comes back with My Plan open");
  assert.match(screen, /enabled: phase === "draft" && dates\.length > 0 && \(!isGuest \|\| guestId !== null\)/, "a guest's first build waits for the anonymous id");

  console.log("guest day scenario draft tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
