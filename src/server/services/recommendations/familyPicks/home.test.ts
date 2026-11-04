import assert from "node:assert/strict";
import test from "node:test";
import { loadHomeEvents, publicHomeWeekRange } from "./home";
import { resolveHomeRequest } from "./homeRequest";
import type { FamilyPicksProfile } from "./profile";
import type { HomeFamilyContext } from "@/features/city-home/lib/familyHome";
import type { HomeFamilyDelivery } from "./delivery";
const context: HomeFamilyContext = { actorId: "account_a", signature: "a".repeat(64), policyVersion: "v2", day: "2030-11-02", selectedChildId: null, preferenceVersion: null,
  selectionPersistence: "account", audience: "personalized", children: [{ id: "child_0001", name: null, hasBirthDate: true, ageFilter: ["3-5"] }] };
const child = { id: "child_0001", name: null, birthDate: new Date("2020-01-01Z"), birthPrecision: "DAY" as const, systemInterests: [] };
function profile(children = [child], userId: string | null = "account_a"): FamilyPicksProfile {
  return { userId, audience: !userId ? "guest" : children.some(child => child.birthDate) ? "personalized" : "no_child_with_DOB", children };
}
for (const count of [0, 1, 2, 3]) {
  test(`SSR ${count} children chooses exactly one feed; personal never loads Kuda`, async () => {
    const p = profile(Array.from({ length: count }, (_, i) => ({ ...child, id: `child_000${i}` })));
    let common = 0, personalContext = 0;
    const result = await loadHomeEvents(p.userId, "city_a", "minsk", {
      profile: async () => p,
      context: async () => { personalContext++; return { profile: p, context }; },
      common: async (_cityId, _slug, actorId) => {
        assert.equal(actorId, null);
        common++;
        return [{ id: "week_event" }] as never;
      },
    });
    assert.equal(result.mode, count ? "personal" : "general");
    assert.equal(common, count ? 0 : 1);
    assert.equal(personalContext, count ? 1 : 0);
  });
}

test("the public current week is bounded by Minsk Sunday, including timezone/year rollover", () => {
  const monday = publicHomeWeekRange(new Date("2026-11-02T08:00:00Z"));
  assert.equal(monday.start.toISOString(), "2026-11-01T21:00:00.000Z");
  assert.equal(monday.end.toISOString(), "2026-11-08T21:00:00.000Z");

  const sunday = publicHomeWeekRange(new Date("2026-11-07T22:30:00Z")); // Sunday in Minsk.
  assert.equal(sunday.start.toISOString(), "2026-11-07T21:00:00.000Z");
  assert.equal(sunday.end.toISOString(), "2026-11-08T21:00:00.000Z");

  const newYear = publicHomeWeekRange(new Date("2026-12-31T12:00:00Z"));
  assert.equal(newYear.end.toISOString(), "2027-01-03T21:00:00.000Z");
});

test("public home asks discovery for the current week before limiting to seven results", async () => {
  let calls = 0;
  const now = new Date();
  const result = await loadHomeEvents(null, "city_a", "minsk", {
    profile: async () => profile([], null),
    context: async () => { throw new Error("guest context is forbidden"); },
    common: async (_city, _slug, actor, options) => {
      calls++;
      assert.equal(actor, null);
      assert.equal(options?.take, 7);
      assert.deepEqual(options?.eventFilters?.dateRange, publicHomeWeekRange(now));
      assert.equal(options?.eventFilters?.includeNextOccurrenceWithoutSessions, true);
      return [{ id: "weekly" }] as never;
    },
  });
  assert.equal(result.mode, "general");
  assert.equal(result.periodLabel, "На этой неделе");
  assert.equal(result.activities.length, 1);
  assert.equal(calls, 1, "no second query when events exist this week");
});

test("empty week falls back to nearest afisha with an accurate subtitle", async () => {
  const calls: Array<{ dateRange?: { start: Date; end: Date } | null }> = [];
  const result = await loadHomeEvents(null, "city_a", "minsk", {
    profile: async () => profile([], null),
    context: async () => { throw new Error("guest context is forbidden"); },
    common: async (_city, _slug, _actor, options) => {
      calls.push({ dateRange: options?.eventFilters?.dateRange });
      return calls.length === 1 ? [] : [{ id: "next-month-event" }] as never;
    },
  });
  assert.equal(result.periodLabel, "Ближайшие события");
  assert.equal(result.activities[0]?.id, "next-month-event");
  assert.equal(calls.length, 2);
  assert.ok(calls[0]?.dateRange?.start instanceof Date, "first query is week-constrained");
  assert.equal(calls[1]?.dateRange, undefined, "fallback is the standard public discovery window");
});

test("general result carries only the ACL-visible incomplete child for authenticated onboarding", async () => {
  const result = await loadHomeEvents("account_a", "city_a", "minsk", {
    profile: async () => ({ ...profile([]), audience: "no_child_with_DOB", children: [{ ...child, birthDate: null }] }),
    context: async () => { throw new Error("should not read personal context"); },
    common: async () => [],
  });
  assert.equal(result.mode, "general");
  assert.deepEqual(result.incompleteChild, { id: child.id, name: child.name });
});

test("guest and users without complete child profiles stay on public afisha without rollout switches", async () => {
  for (const p of [profile([], null), { ...profile(), audience: "no_child_with_DOB" as const, children: [{ ...child, birthDate: null }] }, profile([])]) {
    const result = await loadHomeEvents(p.userId, "city_a", "minsk", { profile: async () => p, context: async () => { throw new Error("must not read personal"); }, common: async () => [] });
    assert.equal(result.mode, "general");
  }
});

test("profile failure never produces a general fallback or a second feed", async () => {
  await assert.rejects(loadHomeEvents("account_a", "city_a", "minsk", { profile: async () => { throw new Error("ACL failed"); }, context: async () => { throw new Error("unexpected"); }, common: async () => { throw new Error("wrong fallback"); } }), /ACL failed/);
});

function dependencies() {
  const calls: string[] = [];
  return { calls, deps: {
    context: async () => { calls.push("context"); return { profile: profile(), context }; },
    deliver: async () => { calls.push("delivery"); return { runId: "final_run" } as unknown as HomeFamilyDelivery; },
    saveSelection: async () => { calls.push("selection"); return true; },
    verify: async () => null as { runId: string; exposureId: string } | null,
    track: async () => ({ ok: true as const }),
    publicEvent: async () => ({ id: "event_0001" }),
  } };
}

test("API context/cache validation does not deliver; final v2 is explicit and signed by current profile", async () => {
  const { deps, calls } = dependencies();
  assert.equal((await resolveHomeRequest({ action: "context", city: "minsk" }, "account_a", null, deps)).status, 200);
  assert.deepEqual(calls, ["context"]);
  assert.equal((await resolveHomeRequest({ action: "recommend", city: "minsk", signature: context.signature, selectedChildId: child.id }, "account_a", null, deps)).status, 200);
  assert.equal(calls.filter(call => call === "delivery").length, 1);
});

test("API guest/malformed/foreign/stale cannot rank or leak another actor", async () => {
  const { deps, calls } = dependencies();
  const request = { action: "recommend", city: "minsk", signature: context.signature };
  assert.equal((await resolveHomeRequest(request, null, null, deps)).status, 401);
  assert.equal((await resolveHomeRequest({ ...request, selectedChildId: "!" }, "account_a", null, deps)).status, 400);
  assert.equal((await resolveHomeRequest({ ...request, selectedChildId: "foreign_01" }, "account_a", null, deps)).status, 404);
  assert.equal((await resolveHomeRequest({ ...request, signature: "b".repeat(64) }, "account_a", null, deps)).status, 409);
  assert.ok(!calls.includes("delivery"));
});

test("child scoped dismissal requires an owned child and preserves context in telemetry", async () => {
  const { deps } = dependencies();
  const raw = { action: "dismiss", city: "minsk", eventId: "event_0001",
    exposureId: null, token: "dismiss_owned", selectedChildId: "child_0001" };
  assert.equal((await resolveHomeRequest({ ...raw, selectedChildId: "foreign_01" }, "account_a", null, deps)).status, 404);
  let meta: Record<string, unknown> | null = null;
  const accepted = await resolveHomeRequest(raw, "account_a", null, {
    ...deps, track: async (input: import("@/lib/analytics/types").TrackUserEventInput) => {
      meta = input.meta ?? {};
      return { ok: true as const };
    },
  });
  assert.equal(accepted.status, 200);
  assert.equal((meta as Record<string, unknown> | null)?.homeSelectedChildId, "child_0001");
});

test("client exposure is verified before DISMISS; failure is retryable, never trusted", async () => {
  const { deps } = dependencies();
  const request = { action: "dismiss", city: "minsk", eventId: "event_0001", exposureId: "foreign_exposure", token: "dismiss_0001" };
  assert.equal((await resolveHomeRequest(request, "account_a", null, deps)).status, 404);
  assert.equal((await resolveHomeRequest({ ...request, exposureId: null }, "account_a", null, { ...deps, track: async () => ({ ok: false, error: "DB unavailable" }) })).status, 503);
});

// Future rollouts must not silently replace a signed-in family's chips with guest afisha.
test("personalized afisha and private API are always available without an environment switch", async () => {
  const p = profile();
  let contextReads = 0;
  const events = await loadHomeEvents("account_a", "city_a", "minsk", {
    profile: async () => p,
    context: async () => { contextReads++; return { profile: p, context }; },
    common: async () => { throw new Error("personalized user must not get guest feed"); },
  });
  assert.equal(events.mode, "personal");
  assert.equal(contextReads, 1);
  const { deps } = dependencies();
  assert.equal((await resolveHomeRequest({ action: "context", city: "minsk" }, "account_a", null, deps)).status, 200);
});
