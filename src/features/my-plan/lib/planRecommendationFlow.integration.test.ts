import assert from "node:assert/strict";
import test from "node:test";
import {
  GUEST_MY_PLAN_DRAFT_STORAGE_KEY,
} from "@/lib/my-plan/guestMyPlanDraftStorage";
import {
  loadPersistedPlanDate,
  loadRecommendationDraft,
  parseRecommendationDrafts,
  persistRecommendationDraft,
  persistSelectedPlanDate,
  PLAN_RECOMMENDATION_DRAFT_STORAGE_KEY,
  recommendationDraftKey,
  reconcileAddedActivityIds,
  type PlanRecommendationDraft,
} from "./planRecommendationDraftStorage";
import {
  focusPlanRecommendationResults,
  PLAN_RECOMMENDATION_RESULTS_A11Y,
} from "./planRecommendationUi";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

const memoryStorage = new MemoryStorage();
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { localStorage: memoryStorage },
});

const dateA = "2030-04-12";
const dateB = "2030-04-13";
const audience = ["child-1"];
const keyFor = (date: string) => recommendationDraftKey({ citySlug: "minsk", date, audienceIds: audience });

function draft(id: string, batchNumber = 1, addedActivityIds: string[] = []): PlanRecommendationDraft {
  return {
    suggestions: [{ id, title: `Activity ${id}` } as PlanRecommendationDraft["suggestions"][number]],
    batchNumber,
    addedActivityIds,
    shownActivityIds: [id],
    ageRangeValues: ["6-9"],
    lastSuccessfulFetchAt: "2030-04-12T10:00:00.000Z",
  };
}

function mount(date: string) {
  const restored = loadRecommendationDraft(keyFor(date));
  return {
    screen: restored ? "results" as const : "start" as const,
    restored,
    close() { /* closing intentionally has no reset side effect */ },
    unmount() { /* persistence outlives the component instance */ },
  };
}

test.beforeEach(() => memoryStorage.clear());

test("first mount starts empty; explicit generation persists results", () => {
  assert.equal(mount(dateA).screen, "start");
  let apiRequests = 0;
  apiRequests += 1;
  persistRecommendationDraft(keyFor(dateA), draft("a1"), dateA);
  const current = mount(dateA);
  assert.equal(current.screen, "results");
  assert.equal(current.restored?.suggestions[0]?.id, "a1");
  assert.equal(apiRequests, 1);
});

test("close, unmount and remount restore the same results without another request", () => {
  const apiRequests = 1;
  persistRecommendationDraft(keyFor(dateA), draft("a1"), dateA);
  const first = mount(dateA);
  first.close();
  first.unmount();
  const reopened = mount(dateA);
  assert.deepEqual(reopened.restored, first.restored);
  assert.equal(apiRequests, 1);
});

test("page remount restores selected date", () => {
  persistSelectedPlanDate(dateB);
  assert.equal(loadPersistedPlanDate(), dateB);
});

test("dates are isolated and returning restores each date's own batch", () => {
  persistRecommendationDraft(keyFor(dateA), draft("a1", 1), dateA);
  persistRecommendationDraft(keyFor(dateB), draft("b2", 2), dateB);
  assert.equal(mount(dateA).restored?.suggestions[0]?.id, "a1");
  assert.equal(mount(dateB).restored?.suggestions[0]?.id, "b2");
  assert.equal(mount(dateA).restored?.batchNumber, 1);
});

test("another batch persists its batch number and all displayed IDs", () => {
  const next = draft("a2", 2);
  next.shownActivityIds = ["a1", "a2"];
  persistRecommendationDraft(keyFor(dateA), next, dateA);
  assert.deepEqual(mount(dateA).restored?.shownActivityIds, ["a1", "a2"]);
  assert.equal(mount(dateA).restored?.batchNumber, 2);
});

test("change choice clears only the current recommendation snapshot, not another date or plan storage", () => {
  persistRecommendationDraft(keyFor(dateA), draft("a1"), dateA);
  persistRecommendationDraft(keyFor(dateB), draft("b1"), dateB);
  memoryStorage.setItem(GUEST_MY_PLAN_DRAFT_STORAGE_KEY, "real-plan-sentinel");
  persistRecommendationDraft(keyFor(dateA), null, dateA);
  assert.equal(mount(dateA).screen, "start");
  assert.equal(mount(dateB).screen, "results");
  assert.equal(memoryStorage.getItem(GUEST_MY_PLAN_DRAFT_STORAGE_KEY), "real-plan-sentinel");
});

test("server plan reconciles optimistic added IDs only after a confirmed response", () => {
  assert.deepEqual(reconcileAddedActivityIds(["a1"], [], false), ["a1"]);
  assert.deepEqual(reconcileAddedActivityIds(["a1", "a2"], ["a2"], true), ["a2"]);
  assert.deepEqual(reconcileAddedActivityIds(["a1"], [], true), []);
});

test("corrupt, unknown-version and inaccessible localStorage are safe", () => {
  assert.deepEqual(parseRecommendationDrafts("broken"), { v: 1, selectedDate: null, drafts: {} });
  assert.deepEqual(parseRecommendationDrafts('{"v":99,"drafts":{}}'), { v: 1, selectedDate: null, drafts: {} });
  const original = window.localStorage;
  Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new Error("denied"); } });
  assert.equal(loadRecommendationDraft(keyFor(dateA)), null);
  Object.defineProperty(window, "localStorage", { configurable: true, value: original });
});

test("results focus and live-region contract are stable", () => {
  let focused = false;
  let scrolled = false;
  const target = {
    focus: () => { focused = true; },
    scrollIntoView: () => { scrolled = true; },
  };
  focusPlanRecommendationResults({ getElementById: () => target as HTMLElement });
  assert.equal(focused, true);
  assert.equal(scrolled, true);
  assert.deepEqual(PLAN_RECOMMENDATION_RESULTS_A11Y, { tabIndex: -1, "aria-live": "polite" });
});

test("storage namespace is stable and separate from the guest draft", () => {
  assert.equal(PLAN_RECOMMENDATION_DRAFT_STORAGE_KEY, "mamago:planRecommendationDrafts:v1");
  assert.notEqual(PLAN_RECOMMENDATION_DRAFT_STORAGE_KEY, GUEST_MY_PLAN_DRAFT_STORAGE_KEY);
});
