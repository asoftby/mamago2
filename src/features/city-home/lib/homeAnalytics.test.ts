import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { persistActivitySave } from "@/features/save/persistActivitySave";
import { buildSavePostAuthContext } from "@/lib/post-auth/saveFlowContext";
import { executePendingPostAuthAction } from "@/lib/post-auth/executePendingAction";
import { homeChipSelectEvent, homeCatalogEvent } from "./homeInteractionTelemetry";

const attribution = { planAddSource: "home-family-picks", recommendationExposureId: "opaque-exposure" } as const;
const meta = { activityId: "event", title: "Synthetic event", planAttribution: attribution };
test("only an intentional plan action forwards attribution; legacy body stays optional", async () => {
  const calls: { url: string; method?: string; body: Record<string, unknown> }[] = [];
  const old = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method, body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response("{}", { status: 200 });
  };
  try {
    await persistActivitySave({ action: "cancel" }, meta);
    assert.equal(calls.length, 0);
    await persistActivitySave({ action: "ideas" }, meta);
    await persistActivitySave({ action: "remove-idea" }, meta);
    await persistActivitySave({ action: "remove-plan", planItemId: "plan" }, meta);
    for (const call of calls) assert.equal(call.body.planAddSource, undefined);
    await persistActivitySave({ action: "plan", dateISO: "2030-11-04", visibility: "PRIVATE" }, meta);
    assert.deepEqual(calls.at(-1)?.body, { activityId: "event", date: "2030-11-04", title: meta.title, visibility: "PRIVATE", ...attribution });
    await persistActivitySave({ action: "plan", dateISO: "2030-11-04" }, { activityId: "event", title: "Legacy" });
    assert.equal(calls.at(-1)?.body.planAddSource, undefined);
    globalThis.fetch = async () => new Response("{}", { status: 500 });
    await assert.rejects(persistActivitySave({ action: "plan", dateISO: "2030-11-04" }, meta), /plan_save_failed/);
  } finally { globalThis.fetch = old; }
});

test("auth resume preserves explicit exposure and Minsk day only for save_plan", async () => {
  const common = { returnTo: "/minsk", entityId: "event", entityType: "activity" as const, planAttribution: attribution };
  const idea = buildSavePostAuthContext({ ...common, result: { action: "ideas" } });
  assert.equal("planAttribution" in idea.pendingAction!, false);
  const plan = buildSavePostAuthContext({ ...common, result: { action: "plan", dateISO: "2030-11-04" } });
  const old = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.date, "2030-11-04");
    assert.equal(body.recommendationExposureId, attribution.recommendationExposureId);
    assert.equal(body.planAddSource, attribution.planAddSource);
    return new Response("{}");
  };
  try { await executePendingPostAuthAction(plan.pendingAction); } finally { globalThis.fetch = old; }
});

test("explicit chip transitions emit once, including child to child, without identities", () => {
  for (const [previous, next] of [[null, "child-secret-A"], ["child-secret-A", null], ["child-secret-A", "child-secret-B"]]) {
    const event = homeChipSelectEvent(previous, next, "minsk");
    assert.equal(event?.eventType, "FILTER_APPLY");
    assert.equal(event?.meta?.selectionMode, next ? "CHILD" : "ALL_FAMILY");
    assert.equal(event?.meta?.action, "home_chip_select");
    assert.doesNotMatch(JSON.stringify(event), /child-secret|birthDate|selectedChildId|name/);
  }
  assert.equal(homeChipSelectEvent(null, null, "minsk"), null);
  assert.equal(homeChipSelectEvent("child-secret-A", "child-secret-A", "minsk"), null);
});
test("catalog is a CTA event with no plan signal or family identity", () => {
  const event = homeCatalogEvent("secret-child-id", "minsk");
  assert.equal(event.eventType, "CTA_CLICK");
  assert.equal(event.meta?.targetAction, "catalog");
  assert.equal(event.meta?.placement, "HOME_FOR_FAMILY");
  assert.doesNotMatch(JSON.stringify(event), /secret-child-id|PLAN_ADD|birthDate/);
});
test("home has no chip-driven requests, while keeping one catalog CTA", () => {
  const source = readFileSync(new URL("../components/CityHomeFamilyPicks.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /homeChipSelectEvent|persistHomeSelection|router.push/);
  assert.match(source, /homeCatalogEvent/);
  assert.ok(source.includes("<EventCard"));
});
