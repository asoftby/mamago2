import assert from "node:assert/strict";
import test from "node:test";
import { confirmedAgeMatchAt, selectPersonalFamilyPicks, type PersonalFamilyCandidate, type PersonalFamilyChild } from "./select";
import { collectConfirmedOccurrences, resolvePersonalShowWindow } from "./window";
import { loadPersonalFamilyPicks, FamilyPicksSelectionUnavailableError, upcomingPlanBlocksFamilyPick, partitionPlannedFamilyPickExclusions, excludePlannedFamilyPickDates } from "./load";
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

for (const count of [0, 1, 2, 3, 4, 7, 8, 10, 11]) {
  test(`${count} confirmed events: return up to ten, never hide a short result`, () => {
    const result = selectPersonalFamilyPicks(Array.from({ length: count }, (_, i) => event(`event_${i}`)), children, all);
    assert.equal(result.length, Math.min(count, 10));
    assert.ok(result.every(item => item.allChildrenMatch));
  });
}
for (const andCount of [0, 3, 4, 7]) {
  test(`AND ${andCount}: OR only below four, always after AND`, () => {
    const and = Array.from({ length: andCount }, (_, i) => event(`and_${i}`));
    const or = Array.from({ length: 8 }, (_, i) => event(`or_${i}`, { sharedScore: 1000, ageMaxMonths: 90 }));
    const result = selectPersonalFamilyPicks([...or, ...and], children, all);
    assert.equal(result.filter(pick => pick.allChildrenMatch).length, andCount);
    assert.equal(result.length, andCount >= 4 ? andCount : Math.min(andCount + 8, 10));
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

test("free global discovery keeps mismatched and adult events with no false child fit", () => {
  const result = selectPersonalFamilyPicks([
    event("adult-only", { agePolicy: "ADULT_ONLY", sharedScore: 30 }),
    event("child", { ageMaxMonths: 90, sharedScore: 5 }),
    event("older-only", { ageMinMonths: 240, ageMaxMonths: 360, sharedScore: 4 }),
  ], children, { mode: "DISCOVERY" });
  assert.deepEqual(result.map(item => item.candidate.id), ["adult-only", "child", "older-only"]);
  assert.deepEqual(result.find(item => item.candidate.id === "adult-only")?.matchedChildIds, []);
});

test("manual 18+ choice ranks adult-compatible events first without hiding other events", () => {
  const candidates = [
    event("child", { ageMaxMonths: 120, sharedScore: 100 }),
    event("adult", { agePolicy: "ADULT_ONLY", ageMinMonths: 216, ageMaxMonths: null, sharedScore: 1 }),
    event("all-ages", { agePolicy: "UNRESTRICTED", ageMinMonths: null, ageMaxMonths: null, sharedScore: 2 }),
  ];
  const picks = selectPersonalFamilyPicks(candidates, children, { mode: "DISCOVERY" }, ["18+"]);
  assert.deepEqual(picks.map(p => p.candidate.id), ["all-ages", "adult"]);
  const childPicks = selectPersonalFamilyPicks(candidates, children, { mode: "DISCOVERY" }, ["3-5"]);
  assert.equal(childPicks.at(-1)?.candidate.id, "adult");
});

test("strict adult-only header intent never returns child or teen events, including on repeats", () => {
  const candidates = [
    event("kid", { ageMinMonths: 0, ageMaxMonths: 120, sharedScore: 999 }),
    event("teen", { ageMinMonths: 144, ageMaxMonths: 216 }),
    event("adult", { agePolicy: "ADULT_ONLY", ageMinMonths: 216, ageMaxMonths: null }),
    event("mixed", { ageMinMonths: 72, ageMaxMonths: 360 }),
  ];
  for (const selection of [{ mode: "DISCOVERY" } as const,
    { mode: "PERSONAS", selectedChildIds: [] as string[], includeAdult: true } as const]) {
    const result = selectPersonalFamilyPicks(candidates, children, selection,
      selection.mode === "DISCOVERY" ? ["18+"] : []);
    assert.deepEqual(result.map(item => item.candidate.id).sort(), ["adult", "mixed"]);
  }
});

test("multi-persona global selection ranks verified child/adult fits first but never pretends a mismatch fits", () => {
  const candidates = [
    event("too-old", { ageMinMonths: 144, ageMaxMonths: 180, sharedScore: 100 }),
    event("for-six", { ageMaxMonths: 90, sharedScore: 2 }),
    event("adults", { agePolicy: "ADULT_ONLY", sharedScore: 3 }),
  ];
  const kidOnly = selectPersonalFamilyPicks(candidates, children, {
    mode: "PERSONAS", selectedChildIds: [children[0]!.id], includeAdult: false,
  });
  assert.equal(kidOnly[0]?.candidate.id, "for-six");
  assert.equal(kidOnly.at(-1)?.matchedChildIds.length, 0);
  const adultAndKid = selectPersonalFamilyPicks(candidates, children, {
    mode: "PERSONAS", selectedChildIds: [children[0]!.id], includeAdult: true,
  });
  assert.deepEqual(adultAndKid.slice(0, 2).map(item => item.candidate.id), ["adults", "for-six"]);
});

test("Nov 7 2026 cyberclass age 9–18 is ranked ahead of mismatches for a selected child", () => {
  const taya = { id: "taya", birthDate: new Date("2016-06-15T00:00:00Z"), birthPrecision: "DAY" as const };
  const saturday = new Date("2026-11-07T08:30:00Z");
  const cyberclass = event("cyberclass-life", {
    agePolicy: "SPECIFIC", ageMinMonths: 108, ageMaxMonths: 216,
    occurrences: [saturday], sharedScore: 1,
  });
  const mismatch = event("not-for-taya", {
    agePolicy: "SPECIFIC", ageMinMonths: 0, ageMaxMonths: 60,
    occurrences: [saturday], sharedScore: 999,
  });
  const selection = { mode: "PERSONAS" as const, selectedChildIds: ["taya"], includeAdult: false };
  const result = selectPersonalFamilyPicks([mismatch, cyberclass], [taya], selection);
  assert.equal(result[0]?.candidate.id, "cyberclass-life");
  assert.equal(result[0]?.targetFit, true);
  assert.equal(result[0]?.startsAt.toISOString(), saturday.toISOString());
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
    loadExcluded: async () => ({ excludedActivityIds: [], plannedDatesByActivity: {} }),
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
    assert.equal(f.calls.length, 1);
    assert.equal(result.window.horizonDays, 30);
    assert.equal(result.items.length, dates.length);
    assert.equal(result.runId, null);
    assert.ok(result.items.every(item => item.exposureId === null));
    assert.equal(result.policyVersion, "family-picks-confirmed-v3");
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
  assert.equal(f.calls.length, 1);
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

test("adult-only persona and manual 18+ retain open-ended 18+ and 21+ sessions", () => {
  const candidates = [
    event("adult18-open", { ageMinMonths: 216, ageMaxMonths: null }),
    event("adult21-open", { ageMinMonths: 252, ageMaxMonths: null }),
    event("child-only", { ageMinMonths: 36, ageMaxMonths: 144 }),
    event("unknown", { agePolicy: "UNKNOWN", ageMinMonths: null, ageMaxMonths: null }),
  ];
  const expected = ["adult18-open", "adult21-open"];
  const manual = selectPersonalFamilyPicks(candidates, children, { mode: "DISCOVERY" }, ["18+"]);
  const adult = selectPersonalFamilyPicks(candidates, children, { mode: "PERSONAS", selectedChildIds: [], includeAdult: true });
  assert.deepEqual(manual.map(item => item.candidate.id), expected);
  assert.deepEqual(adult.map(item => item.candidate.id), expected);
  assert.ok(manual.every(item => item.targetFit));
  assert.ok(adult.every(item => item.targetFit));
});

test("past family visits do not exclude future sessions; future bookings respect audience", () => {
  const now = new Date("2026-11-06T10:00:00+03:00");
  const base = { date: "2026-10-27", startsAt: null, childId: null, assigneeUserId: null };
  const forTaya = { mode: "PERSONAS" as const, selectedChildIds: ["taya"], includeAdult: false };
  assert.equal(upcomingPlanBlocksFamilyPick(base, forTaya, "owner", now), false);
  assert.equal(upcomingPlanBlocksFamilyPick({ ...base, date: "2026-11-06" }, forTaya, "owner", now), true);
  assert.equal(upcomingPlanBlocksFamilyPick({ ...base, date: "2026-11-07", childId: "stepa" }, forTaya, "owner", now), false);
  assert.equal(upcomingPlanBlocksFamilyPick({ ...base, date: "2026-11-07", childId: "taya" }, forTaya, "owner", now), true);
  assert.equal(upcomingPlanBlocksFamilyPick({ ...base, date: null, startsAt: new Date("2026-10-27T10:00:00Z") }, forTaya, "owner", now), false);
  assert.equal(upcomingPlanBlocksFamilyPick({ ...base, date: null }, forTaya, "owner", now), true);
  assert.equal(upcomingPlanBlocksFamilyPick({ ...base, date: "2026-11-07", assigneeUserId: "owner" }, forTaya, "owner", now), false);
  assert.equal(upcomingPlanBlocksFamilyPick({ ...base, date: "2026-11-07", assigneeUserId: "owner" }, { ...forTaya, includeAdult: true }, "owner", now), true);
});

test("Cyberclass: planned Nov 9 session does not hide available Nov 7/8 sessions for Taya", () => {
  const now = new Date("2026-11-06T12:00:00Z");
  const selection = { mode: "CHILD" as const, selectedChildId: "taya" };
  const plan = partitionPlannedFamilyPickExclusions([
    { activityId: "cyberclass", date: "2026-10-14", startsAt: null, childId: null, assigneeUserId: null },
    { activityId: "cyberclass", date: "2026-10-27", startsAt: null, childId: null, assigneeUserId: null },
    { activityId: "cyberclass", date: "2026-11-09", startsAt: null, childId: null, assigneeUserId: null },
  ], selection, "owner", now);
  assert.deepEqual(plan.excludedActivityIds, []);
  assert.deepEqual(plan.plannedDatesByActivity, { cyberclass: ["2026-11-09"] });
  const sessions = [7, 8, 9].map(day => new Date(`2026-11-${String(day).padStart(2,"0")}T08:30:00Z`));
  assert.deepEqual(excludePlannedFamilyPickDates("cyberclass", sessions, plan.plannedDatesByActivity), sessions.slice(0, 2));
  const child = { id: "taya", birthDate: new Date("2015-01-01Z"), birthPrecision: "DAY" as const };
  const picks = selectPersonalFamilyPicks([{ ...event("cyberclass", { ageMinMonths: 108, ageMaxMonths: 216 }), occurrences: sessions.slice(0, 2) }], [child], selection);
  assert.equal(picks[0]?.candidate.id, "cyberclass");
  assert.equal(picks[0]?.startsAt.toISOString(), sessions[0]!.toISOString());
});

test("undated plans still block entirely; sibling plans do not block Taya", () => {
  const now = new Date("2026-11-06T12:00:00Z");
  const selection = { mode: "CHILD" as const, selectedChildId: "taya" };
  const plans = partitionPlannedFamilyPickExclusions([
    { activityId: "undated", date: null, startsAt: null, childId: null, assigneeUserId: null },
    { activityId: "sibling", date: "2026-11-07", startsAt: null, childId: "stepa", assigneeUserId: null },
    { activityId: "taya-event", date: "2026-11-07", startsAt: null, childId: "taya", assigneeUserId: null },
  ], selection, "owner", now);
  assert.deepEqual(plans.excludedActivityIds, ["undated"]);
  assert.deepEqual(plans.plannedDatesByActivity, { "taya-event": ["2026-11-07"] });
});
