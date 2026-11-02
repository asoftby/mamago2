import assert from "node:assert/strict";
import test from "node:test";
import { confirmedAgeMatchAt, selectPersonalFamilyPicks, type PersonalFamilyCandidate, type PersonalFamilyChild } from "./select";
import { collectConfirmedOccurrences, resolvePersonalShowWindow } from "./window";
import { loadPersonalFamilyPicks, FamilyPicksSelectionUnavailableError } from "./load";
import { PLAN_SUGGESTION_ALGORITHM_VERSION, type RankedPlanSuggestion, type PlanSuggestionRankedBatch } from "@/server/services/planSuggestions.service";
import { readFileSync } from "node:fs";

const now = new Date("2030-11-02T12:00:00+03:00");
const at = new Date("2030-11-03T12:00:00+03:00");
const children: PersonalFamilyChild[] = [
  { id: "child_0001", birthDate: new Date("2024-01-01Z"), birthPrecision: "DAY" },
  { id: "child_0002", birthDate: new Date("2020-01-01Z"), birthPrecision: "DAY" },
];
function event(id: string, patch: Partial<PersonalFamilyCandidate> = {}): PersonalFamilyCandidate {
  return { id, sharedScore: 1, agePolicy: "SPECIFIC", ageMinMonths: 0, ageMaxMonths: 216,
    categoryId: "same-category", businessId: "same-business", occurrences: [at], ...patch };
}
const all = { mode: "ALL_FAMILY" } as const;

for (const count of [0, 1, 2, 3, 4, 7, 8]) {
  test(`${count} confirmed events: return up to seven, never hide a short result`, () => {
    const result = selectPersonalFamilyPicks(Array.from({ length: count }, (_, i) => event(`event_${i}`)), children, all);
    assert.equal(result.length, Math.min(count, 7));
    assert.ok(result.every(item => item.allChildrenMatch));
  });
}
for (const andCount of [0, 3, 4, 7]) {
  test(`AND ${andCount}: OR only below four, always after AND`, () => {
    const and = Array.from({ length: andCount }, (_, i) => event(`and_${i}`));
    const or = Array.from({ length: 8 }, (_, i) => event(`or_${i}`, { sharedScore: 1000, ageMaxMonths: 90 }));
    const result = selectPersonalFamilyPicks([...or, ...and], children, all);
    assert.equal(result.filter(pick => pick.allChildrenMatch).length, andCount);
    assert.equal(result.length, andCount >= 4 ? andCount : 7);
    assert.ok(result.slice(0, andCount).every(pick => pick.allChildrenMatch));
    assert.ok(result.slice(andCount).every(pick => !pick.allChildrenMatch));
  });
}

test("shared score, then chosen date, then ID; no duplicates or hard diversity cap", () => {
  const candidates = [event("b"), event("a"), event("c", { sharedScore: 4 }), event("a")];
  assert.deepEqual(selectPersonalFamilyPicks(candidates, children, all).map(p => p.candidate.id), ["c", "a", "b"]);
  assert.deepEqual(selectPersonalFamilyPicks([...candidates].reverse(), children, all).map(p => p.candidate.id), ["c", "a", "b"]);
});

test("DAY birthday is evaluated on the session's local date, not today or UTC", () => {
  const child = { ...children[0]!, birthDate: new Date("2024-11-06Z") };
  const candidate = event("birthday", { ageMinMonths: 72, ageMaxMonths: 72 });
  assert.equal(confirmedAgeMatchAt(child, candidate, new Date("2030-11-05T12:00:00Z")), "MISMATCH");
  assert.equal(confirmedAgeMatchAt(child, candidate, new Date("2030-11-05T22:00:00Z")), "MATCH");
});

test("MONTH / legacy null precision require proof over every possible day", () => {
  for (const birthPrecision of ["MONTH", null] as const) {
    const child = { ...children[0]!, birthDate: new Date("2024-11-01Z"), birthPrecision };
    const candidate = event("month", { ageMinMonths: 72, ageMaxMonths: 72 });
    assert.equal(confirmedAgeMatchAt(child, candidate, new Date("2030-11-15Z")), "UNKNOWN");
    assert.equal(confirmedAgeMatchAt(child, candidate, new Date("2030-11-30Z")), "MATCH");
    assert.equal(confirmedAgeMatchAt(child, candidate, new Date("2030-10-31Z")), "MISMATCH");
  }
});

test("unknown DOB/event age never becomes MATCH, including unrestricted; individual choice is strict", () => {
  const incomplete = { ...children[0]!, birthDate: null };
  assert.equal(confirmedAgeMatchAt(incomplete, event("free-age", { agePolicy: "UNRESTRICTED" }), at), "UNKNOWN");
  assert.equal(confirmedAgeMatchAt(children[0]!, event("unknown", { agePolicy: "UNKNOWN" }), at), "UNKNOWN");
  assert.deepEqual(selectPersonalFamilyPicks([event("a")], [incomplete], { mode: "CHILD", selectedChildId: incomplete.id }), []);
  const picks = selectPersonalFamilyPicks([event("a")], [children[1]!, incomplete], all);
  assert.equal(picks[0]?.allChildrenMatch, false);
  assert.deepEqual(picks[0]?.matchedChildIds, [children[1]!.id]);
  assert.deepEqual(selectPersonalFamilyPicks([event("adult", { agePolicy: "ADULT_ONLY" })], children, all), []);
});

test("multiple sessions: card date and matching children are one consistent proof", () => {
  const child = { ...children[0]!, birthDate: new Date("2024-11-06Z") };
  const before = new Date("2030-11-04Z"), after = new Date("2030-11-07Z");
  const candidate = event("multi", { ageMinMonths: 72, ageMaxMonths: 72, occurrences: [before, after] });
  const result = selectPersonalFamilyPicks([candidate], [child], all);
  assert.equal(result[0]?.startsAt.toISOString(), after.toISOString());
  assert.deepEqual(result[0]?.matchedChildIds, [child.id]);
});

test("individual selection excludes mismatches even when their shared score is higher", () => {
  const result = selectPersonalFamilyPicks([event("older", { ageMinMonths: 100, sharedScore: 100 }), event("younger", { ageMaxMonths: 90 })], children, { mode: "CHILD", selectedChildId: children[0]!.id });
  assert.deepEqual(result.map(pick => pick.candidate.id), ["younger"]);
});

test("7/30 calendar windows include Thursday–Sunday and use Europe/Minsk", () => {
  assert.deepEqual(resolvePersonalShowWindow(new Date("2030-10-31T22:00:00Z"), 7), { dateFrom: "2030-11-01", dateTo: "2030-11-07", horizonDays: 7 });
  assert.equal(resolvePersonalShowWindow(now, 30).dateTo, "2030-12-01");
});

test("confirmed occurrences: boundaries, past, withdrawn, explicit sold-out and no fallback resurrection", () => {
  const options = { rangeStart: new Date("2030-11-02T00:00:00+03:00"), rangeEnd: new Date("2030-11-09T00:00:00+03:00"), now, nextOccurrenceAt: at };
  const sessions = [{ startsAt: at, withdrawnAt: new Date() }, { startsAt: at, withdrawnAt: null, soldOut: true }, { startsAt: new Date(now.getTime() - 1), withdrawnAt: null }, { startsAt: options.rangeEnd, withdrawnAt: null }];
  assert.deepEqual(collectConfirmedOccurrences({ ...options, sessions, hasStoredSessions: true }), []);
  assert.deepEqual(collectConfirmedOccurrences({ ...options, sessions: [], hasStoredSessions: true }), []);
  assert.deepEqual(collectConfirmedOccurrences({ ...options, sessions: [], hasStoredSessions: false }), [at]);
  assert.deepEqual(collectConfirmedOccurrences({ ...options, nextOccurrenceAt: null, sessions: [], hasStoredSessions: false }), []);
});

function fixture(dates: Date[]) {
  const calls: string[] = [];
  const profile = { userId: "account_a", audience: "personalized" as const,
    children: children.map(child => ({ ...child, name: null, birthDate: child.birthDate as Date, systemInterests: [] })) };
  return { calls, profile, deps: {
    loadProfile: async () => profile,
    loadExcluded: async () => [],
    loadAffinity: async () => ({ subjects: [], outcomeEventCount: 0, horizonDays: 365 }),
    rank: async (input: { dateFrom?: string; dateTo?: string }): Promise<PlanSuggestionRankedBatch> => {
      calls.push(input.dateTo!);
      return { algorithmVersion: PLAN_SUGGESTION_ALGORITHM_VERSION, candidateCount: dates.length,
        suggestions: dates.map((_, index) => ({ activity: { id: `event_${index}`, title: "Событие", eventCategory: null }, score: 1 } as unknown as RankedPlanSuggestion)) };
    },
    loadExtras: async () => dates.map((date, index) => ({ id: `event_${index}`, agePolicy: "SPECIFIC" as const, ageMinMonths: 0, ageMaxMonths: 216,
      businessId: null, nextOccurrenceAt: date, sessions: [{ startsAt: date, withdrawnAt: null }], _count: { sessions: 1 } })),
  } };
}
for (const dates of [[], [at], [at, new Date("2030-11-04Z")], [new Date("2030-11-20Z")]]) {
  test(`loader fallback for ${dates.length} dated candidates`, async () => {
    const f = fixture(dates);
    const result = await loadPersonalFamilyPicks({ userId: "account_a", citySlug: "minsk", selection: all, now }, f.deps);
    const narrowHasMatches = dates.some(date => date < new Date("2030-11-09T00:00:00+03:00"));
    assert.equal(f.calls.length, narrowHasMatches ? 1 : 2);
    assert.equal(result.window.horizonDays, narrowHasMatches ? 7 : 30);
    assert.equal(result.items.length, dates.length);
    assert.equal(result.runId, null);
    assert.ok(result.items.every(item => item.exposureId === null));
    assert.equal(result.policyVersion, "family-picks-confirmed-v2");
  });
}

test("unavailable selected ID fails before ranking or trace; profile errors propagate", async () => {
  const f = fixture([at]);
  await assert.rejects(loadPersonalFamilyPicks({ userId: "account_a", citySlug: "minsk", selection: { mode: "CHILD", selectedChildId: "foreign_01" }, now }, f.deps), FamilyPicksSelectionUnavailableError);
  assert.equal(f.calls.length, 0);
  await assert.rejects(loadPersonalFamilyPicks({ userId: "account_a", citySlug: "minsk", selection: all, now }, { ...f.deps, loadProfile: async () => { throw new Error("DB unavailable"); } }), /DB unavailable/);
});

test("legacy GET resolver remains disconnected from v2 composition", () => {
  for (const path of ["src/server/services/recommendations/familyPicks/request.ts", "src/app/api/recommendations/family-picks/route.ts"]) {
    assert.doesNotMatch(readFileSync(path, "utf8"), /loadPersonalFamilyPicks|selectPersonalFamilyPicks/);
  }
});


test("AND cannot be assembled from matches at different sessions", () => {
  const family: PersonalFamilyChild[] = [
    { id: "child_0001", birthDate: new Date("2024-12-01Z"), birthPrecision: "DAY" },
    { id: "child_0002", birthDate: new Date("2024-12-06Z"), birthPrecision: "DAY" },
  ];
  const result = selectPersonalFamilyPicks([event("split-dates", {
    ageMinMonths: 71, ageMaxMonths: 71, occurrences: [new Date("2030-11-02Z"), new Date("2030-12-02Z")],
  })], family, all);
  assert.equal(result[0]?.allChildrenMatch, false);
  assert.equal(result[0]?.matchedChildIds.length, 1);
});

test("unknown-age week cannot suppress the 30-day confirmed-age search", async () => {
  const f = fixture([at]);
  const result = await loadPersonalFamilyPicks({ userId: "account_a", citySlug: "minsk", selection: all, now }, {
    ...f.deps,
    loadExtras: async () => (await f.deps.loadExtras()).map(extra => ({ ...extra, agePolicy: "UNKNOWN" as const })),
  });
  assert.equal(f.calls.length, 2);
  assert.equal(result.window.horizonDays, 30);
  assert.equal(result.status, "EMPTY");
  assert.deepEqual(result.items, []);
});

test("mixed businesses/categories cannot displace AND or override shared relevance", () => {
  const result = selectPersonalFamilyPicks([
    event("and_b", { sharedScore: 2, categoryId: "music", businessId: "business_b" }),
    event("and_a", { sharedScore: 3, categoryId: "science", businessId: "business_a" }),
    event("or", { sharedScore: 100, ageMaxMonths: 90, categoryId: "sport", businessId: "business_c" }),
  ], children, all);
  assert.deepEqual(result.map(pick => pick.candidate.id), ["and_a", "and_b", "or"]);
});
