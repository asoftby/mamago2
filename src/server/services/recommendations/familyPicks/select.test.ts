import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_FAMILY_PICKS_CONFIG, normalizeFamilyPicksConfig } from "./config";
import {
  ageMatchForChild,
  ageFilterKeysForChildren,
  ageMonthsAt,
  buildReasonChips,
  evaluateAge,
  formatChildNames,
  selectFamilyPicks,
  type FamilyChild,
  type FamilyContext,
  type FamilyPickCandidate,
} from "./select";
import { resolveShowWindow } from "./window";

const NOW = new Date("2026-10-29T09:00:00+03:00"); // четверг
const WINDOW = resolveShowWindow(NOW); // сб 31.10 – вс 01.11
const SAT = new Date("2026-10-31T11:00:00+03:00");
const SUN = new Date("2026-11-01T11:00:00+03:00");
const WED = new Date("2026-10-28T11:00:00+03:00");

let seq = 0;
function cand(over: Partial<FamilyPickCandidate> = {}): FamilyPickCandidate {
  seq += 1;
  return {
    entityType: "EVENT",
    id: `e${seq}`,
    categoryId: `cat${seq}`,
    businessId: `biz${seq}`,
    agePolicy: "SPECIFIC",
    ageMinMonths: 48,
    ageMaxMonths: 96,
    interestSlugs: [],
    occurrences: [SAT],
    alwaysAvailable: false,
    territory: "CITY",
    isFree: false,
    engagementScore: 0,
    interestBoost: 0,
    experienceAffinityBoost: 0,
    ...over,
  };
}

const stepa: FamilyChild = { id: "c1", name: "Стёпа", ageMonths: 60, interestSlugs: ["sport"] };
const masha: FamilyChild = { id: "c2", name: "Маша", ageMonths: 20, interestSlugs: [] };

function ctx(over: Partial<FamilyContext> = {}): FamilyContext {
  return {
    children: [stepa],
    knownCategoryIds: new Set(),
    excludedKeys: new Set(),
    hasHistory: false,
    ...over,
  };
}

const run = (cands: FamilyPickCandidate[], c: FamilyContext, config = DEFAULT_FAMILY_PICKS_CONFIG) =>
  selectFamilyPicks(cands, c, WINDOW, config, NOW);

// ─── возраст ──────────────────────────────────────────────────────────────

test("ageMonthsAt counts full months", () => {
  assert.equal(ageMonthsAt(new Date("2021-10-30"), new Date("2026-10-29")), 59);
  assert.equal(ageMonthsAt(new Date("2021-10-29"), new Date("2026-10-29")), 60);
});

test("age: MATCH inside range inclusive, MISMATCH outside, UNKNOWN without data", () => {
  const range = { agePolicy: "SPECIFIC" as const, ageMinMonths: 48, ageMaxMonths: 96 };
  assert.equal(ageMatchForChild({ ageMonths: 48 }, range), "MATCH");
  assert.equal(ageMatchForChild({ ageMonths: 96 }, range), "MATCH");
  assert.equal(ageMatchForChild({ ageMonths: 47 }, range), "MISMATCH");
  assert.equal(ageMatchForChild({ ageMonths: 97 }, range), "MISMATCH");
  assert.equal(ageMatchForChild({ ageMonths: null }, range), "UNKNOWN");
  const unknown = { agePolicy: "UNKNOWN" as const, ageMinMonths: null, ageMaxMonths: null };
  assert.equal(ageMatchForChild({ ageMonths: 60 }, unknown), "UNKNOWN");
  assert.equal(ageMatchForChild({ ageMonths: 60 }, { ...unknown, agePolicy: "UNRESTRICTED" }), "MATCH");
  assert.equal(ageMatchForChild({ ageMonths: 60 }, { ...unknown, agePolicy: "ADULT_ONLY" }), "MISMATCH");
  // 24afisha: только минимальный возраст
  assert.equal(ageMatchForChild({ ageMonths: 60 }, { agePolicy: "UNKNOWN", ageMinMonths: 72, ageMaxMonths: null }), "MISMATCH");
  assert.equal(ageMatchForChild({ ageMonths: 80 }, { agePolicy: "UNKNOWN", ageMinMonths: 72, ageMaxMonths: null }), "MATCH");
});

test("age is evaluated per child: any MATCH wins, then UNKNOWN, then MISMATCH", () => {
  const c = cand({ ageMinMonths: 48, ageMaxMonths: 96 });
  assert.deepEqual(evaluateAge([stepa, masha], c), { match: "MATCH", matchedChildIds: ["c1"] });
  assert.equal(evaluateAge([masha], c).match, "MISMATCH");
  assert.equal(evaluateAge([masha, { ...stepa, ageMonths: null }], c).match, "UNKNOWN");
  assert.equal(evaluateAge([], c).match, "NONE");
});

// ─── жёсткие фильтры ──────────────────────────────────────────────────────

test("hard filters: excluded, adult-only, all-children mismatch, out of window", () => {
  const ok = cand();
  const excluded = cand();
  const adult = cand({ agePolicy: "ADULT_ONLY", ageMinMonths: null, ageMaxMonths: null });
  const mismatch = cand({ ageMinMonths: 120, ageMaxMonths: 200 });
  const outOfWindow = cand({ occurrences: [], alwaysAvailable: false });
  const base = [ok, cand(), cand(), cand(), cand()];
  const result = run(
    [...base, excluded, adult, mismatch, outOfWindow],
    ctx({ excludedKeys: new Set([`EVENT:${excluded.id}`]) }),
  );
  const ids = result.items.map((i) => i.candidate.id);
  for (const bad of [excluded, adult, mismatch, outOfWindow]) assert.ok(!ids.includes(bad.id));
  assert.deepEqual(result.filtered, { EXCLUDED: 1, ADULT_ONLY: 1, AGE_MISMATCH: 1, OUT_OF_WINDOW: 1 });
});

test("event for one of two children stays; mismatch for all children is dropped", () => {
  const forMasha = cand({ ageMinMonths: 12, ageMaxMonths: 36 });
  const forNobody = cand({ ageMinMonths: 200, ageMaxMonths: 300 });
  const filler = [cand(), cand(), cand()];
  const r = run([forMasha, forNobody, ...filler], ctx({ children: [stepa, masha] }));
  const ids = r.items.map((i) => i.candidate.id);
  assert.ok(ids.includes(forMasha.id));
  assert.ok(!ids.includes(forNobody.id));
});

// ─── MATCH выше UNKNOWN ───────────────────────────────────────────────────

test("MATCH is always above UNKNOWN even when UNKNOWN has a higher raw score", () => {
  const unknownStrong = cand({
    agePolicy: "UNKNOWN",
    ageMinMonths: null,
    ageMaxMonths: null,
    interestSlugs: ["sport"],
    interestBoost: 8,
    experienceAffinityBoost: 6,
    territory: "CITY",
    engagementScore: 999,
  });
  const matchWeak = cand({ occurrences: [WED], territory: "REGION" });
  const fillers = [cand(), cand()];
  const r = run([unknownStrong, matchWeak, ...fillers], ctx());
  const pos = (id: string) => r.items.findIndex((i) => i.candidate.id === id);
  assert.ok(pos(matchWeak.id) >= 0 && pos(unknownStrong.id) >= 0);
  assert.ok(pos(matchWeak.id) < pos(unknownStrong.id));
});

test("UNKNOWN-age items are capped and labelled honestly (never «Подходит»)", () => {
  const unknowns = Array.from({ length: 5 }, () =>
    cand({ agePolicy: "UNKNOWN", ageMinMonths: null, ageMaxMonths: null }),
  );
  const matches = [cand(), cand(), cand()];
  const r = run([...unknowns, ...matches], ctx());
  const unknownItems = r.items.filter((i) => i.ageMatch === "UNKNOWN");
  assert.ok(unknownItems.length <= DEFAULT_FAMILY_PICKS_CONFIG.maxUnknownAgeItems);
  for (const item of unknownItems) {
    assert.ok(item.reasonCodes.includes("AGE_UNKNOWN"));
    assert.ok(!item.reasonCodes.includes("AGE_MATCH"));
    assert.ok(!item.reasonText?.startsWith("Подходит"));
  }
});

// ─── веса ─────────────────────────────────────────────────────────────────

test("score breakdown follows config weights; budget weight 0 adds nothing", () => {
  const c = cand({
    interestSlugs: ["sport", "music"],
    interestBoost: 8,
    isFree: true,
    experienceAffinityBoost: 3,
    occurrences: [SAT],
    territory: "CITY",
  });
  const r = run([c, cand(), cand()], ctx({ children: [{ ...stepa, interestSlugs: ["sport", "music"] }] }));
  const item = r.items.find((i) => i.candidate.id === c.id)!;
  assert.deepEqual(item.scoreBreakdown, {
    age: 25,
    interests: 25,
    date: 30,
    territory: 10,
    history: 5,
    budget: 0,
  });
  assert.equal(item.score, 95);
});

test("changing weights in config changes ranking without code changes", () => {
  const sporty = cand({ interestSlugs: ["sport"], interestBoost: 4, occurrences: [WED] });
  const weekendy = cand({ occurrences: [SAT] });
  const filler = cand({ occurrences: [WED] });
  const c = ctx({ knownCategoryIds: new Set([sporty, weekendy, filler].map((x) => x.categoryId!)) });
  const byDate = run([sporty, weekendy, filler], c, normalizeFamilyPicksConfig({ weights: { interests: 0, date: 60 } }));
  assert.equal(byDate.items[0]!.candidate.id, weekendy.id);
  const byInterest = run([sporty, weekendy, filler], c, normalizeFamilyPicksConfig({ weights: { interests: 80, date: 1 } }));
  assert.equal(byInterest.items[0]!.candidate.id, sporty.id);
});

test("weekend slots score higher than weekdays in weekend mode", () => {
  const sat = cand({ occurrences: [SAT] });
  const sun = cand({ occurrences: [SUN] });
  const fri = cand({ occurrences: [new Date("2026-10-30T19:00:00+03:00")] });
  const r = run([fri, sun, sat], ctx());
  const bySat = r.items.find((i) => i.candidate.id === sat.id)!;
  const byFri = r.items.find((i) => i.candidate.id === fri.id)!;
  assert.ok(bySat.scoreBreakdown.date > byFri.scoreBreakdown.date);
});

// ─── разнообразие ─────────────────────────────────────────────────────────

test("diversity: at most 2 per category and 1 per business", () => {
  const sameCat = Array.from({ length: 5 }, () => cand({ categoryId: "theatre" }));
  const sameBiz = Array.from({ length: 4 }, () => cand({ businessId: "acme", categoryId: null }));
  const r = run([...sameCat, ...sameBiz, cand(), cand()], ctx());
  const cat = r.items.filter((i) => i.candidate.categoryId === "theatre");
  const biz = r.items.filter((i) => i.candidate.businessId === "acme");
  assert.ok(cat.length <= 2);
  assert.ok(biz.length <= 1);
});

test("novelty slot: one «Попробуйте новое» from an unknown category, placed last", () => {
  const known = Array.from({ length: 6 }, (_, i) => cand({ categoryId: `known${i}`, interestSlugs: ["sport"], interestBoost: 4 }));
  const fresh = cand({ categoryId: "brand-new", occurrences: [WED] });
  const c = ctx({ knownCategoryIds: new Set(known.map((k) => k.categoryId!)) });
  const r = run([...known, fresh], c);
  const novelty = r.items.filter((i) => i.isNovelty);
  assert.equal(novelty.length, 1);
  assert.equal(novelty[0]!.candidate.id, fresh.id);
  assert.equal(r.items[r.items.length - 1]!.candidate.id, fresh.id);
  assert.equal(r.items.length, DEFAULT_FAMILY_PICKS_CONFIG.resultCount);
  assert.equal(novelty[0]!.reasonText, "Попробуйте новое");
  assert.ok(novelty[0]!.reasonCodes.includes("NEW_CATEGORY"));
});

test("no novelty candidate: slot is filled by a regular pick", () => {
  const items = Array.from({ length: 8 }, (_, i) => cand({ categoryId: `k${i}` }));
  const r = run(items, ctx({ knownCategoryIds: new Set(items.map((i) => i.categoryId!)) }));
  assert.equal(r.items.filter((i) => i.isNovelty).length, 0);
  assert.equal(r.items.length, DEFAULT_FAMILY_PICKS_CONFIG.resultCount);
});

test("result is deterministic and positions are 1..N", () => {
  const items = Array.from({ length: 8 }, () => cand());
  const a = run(items, ctx());
  const b = run([...items].reverse(), ctx());
  assert.deepEqual(a.items.map((i) => i.candidate.id), b.items.map((i) => i.candidate.id));
  assert.deepEqual(a.items.map((i) => i.position), a.items.map((_, i) => i + 1));
});

// ─── fallback ─────────────────────────────────────────────────────────────

test("PERSONAL level: ages + interests, title «Для вашей семьи»", () => {
  const items = Array.from({ length: 5 }, () => cand({ interestSlugs: ["sport"], interestBoost: 4 }));
  const r = run(items, ctx());
  assert.equal(r.level, "PERSONAL");
  assert.equal(r.title, "Для вашей семьи");
  assert.ok(r.items.every((i) => i.reasonCodes.includes("INTEREST_MATCH")));
  assert.ok(r.items.some((i) => i.reasonText?.startsWith("Подходит: Стёпа")));
});

test("AGE level: ages known, no interests/history → honest age title", () => {
  const items = Array.from({ length: 4 }, () => cand());
  const r = run(items, ctx({ children: [{ ...stepa, interestSlugs: [] }] }));
  assert.equal(r.level, "AGE");
  assert.equal(r.title, "По возрасту ваших детей");
});

test("POPULAR level (cold start): no children → popularity, no personal wording", () => {
  const items = [cand({ engagementScore: 1 }), cand({ engagementScore: 9 }), cand({ engagementScore: 5 }), cand({ engagementScore: 3 })];
  const r = run(items, ctx({ children: [] }));
  assert.equal(r.level, "POPULAR");
  assert.equal(r.title, "Популярное на выходных");
  assert.equal(r.items[0]!.candidate.engagementScore, 9);
  for (const item of r.items) {
    assert.ok(!item.reasonCodes.includes("AGE_MATCH"));
    assert.ok(!item.reasonCodes.includes("INTEREST_MATCH"));
    assert.ok(item.reasonCodes.includes("POPULAR") || item.reasonCodes.includes("DATE_WEEKEND"));
    assert.ok(!item.reasonText?.startsWith("Подходит"));
  }
});

test("POPULAR title for Mon-Wed window", () => {
  const monday = new Date("2026-10-26T10:00:00+03:00");
  const w = resolveShowWindow(monday);
  const items = Array.from({ length: 4 }, () => cand({ occurrences: [new Date("2026-10-27T18:00:00+03:00")] }));
  const r = selectFamilyPicks(items, ctx({ children: [] }), w, DEFAULT_FAMILY_PICKS_CONFIG, monday);
  assert.equal(r.title, "Популярное на этой неделе");
});

test("children without birth dates fall back to POPULAR (age cannot be judged)", () => {
  const items = Array.from({ length: 4 }, () => cand());
  const r = run(items, ctx({ children: [{ ...stepa, ageMonths: null }] }));
  assert.equal(r.level, "POPULAR");
  for (const item of r.items) assert.ok(!item.reasonText?.startsWith("Подходит"));
});

test("fewer than the minimum eligible items → block hidden (NONE)", () => {
  const r = run([cand(), cand()], ctx());
  assert.equal(r.level, "NONE");
  assert.equal(r.items.length, 0);
  assert.equal(r.title, null);
});

test("diversity limits that leave fewer than the minimum also hide the block", () => {
  const items = Array.from({ length: 6 }, () => cand({ categoryId: "same" }));
  const r = run(items, ctx());
  assert.equal(r.level, "NONE");
});

// ─── причины ──────────────────────────────────────────────────────────────

test("reason text formats child names without declension", () => {
  assert.equal(formatChildNames([stepa]), "Стёпа");
  assert.equal(formatChildNames([stepa, masha]), "Стёпа и Маша");
  assert.equal(formatChildNames([stepa, masha, { ...masha, id: "c3", name: null }]), "Стёпа, Маша и ещё 1");
  assert.equal(formatChildNames([{ ...stepa, name: null }]), "ребёнок");
});

test("FREE reason code is present for free events (budget weight stays 0)", () => {
  const free = cand({ isFree: true });
  const r = run([free, cand(), cand(), cand()], ctx());
  const item = r.items.find((i) => i.candidate.id === free.id)!;
  assert.ok(item.reasonCodes.includes("FREE"));
  assert.equal(item.scoreBreakdown.budget, 0);
});

test("duplicates by entity key are collapsed", () => {
  const a = cand();
  const r = run([a, { ...a }, cand(), cand(), cand()], ctx());
  assert.equal(r.items.filter((i) => i.candidate.id === a.id).length, 1);
});

// ─── регрессии по ревью ───────────────────────────────────────────────────

test("interest and history scores are taken from the shared ranker boosts, not recomputed", () => {
  // Интересы ребёнка совпадают по слагам, но общий ранкер дал 0 → балл интересов 0.
  const noBoost = cand({ interestSlugs: ["sport"], interestBoost: 0 });
  const oneMatch = cand({ interestSlugs: ["sport"], interestBoost: 4 });
  const r = run([noBoost, oneMatch, cand(), cand()], ctx());
  const a = r.items.find((i) => i.candidate.id === noBoost.id)!;
  const b = r.items.find((i) => i.candidate.id === oneMatch.id)!;
  assert.equal(a.scoreBreakdown.interests, 0);
  assert.equal(b.scoreBreakdown.interests, 12.5); // 4 / MAX_INTEREST_BOOST(8) × 25
  const hist = cand({ experienceAffinityBoost: -6 });
  const rn = run([hist, cand(), cand(), cand()], ctx());
  assert.equal(rn.items.find((i) => i.candidate.id === hist.id)!.scoreBreakdown.history, -10);
});

test("novelty candidate keeps its business slot: regular picks cannot block it (review repro)", () => {
  const A = cand({ categoryId: "new-cat", businessId: "biz1", occurrences: [SAT] }); // лучший novelty
  const B = cand({ categoryId: "known", businessId: "biz1", occurrences: [SAT], interestBoost: 8, interestSlugs: ["sport"] });
  const C = cand({ categoryId: "known", businessId: "biz2", occurrences: [SAT], interestBoost: 4, interestSlugs: ["sport"] });
  const D = cand({ categoryId: "known", businessId: "biz3", occurrences: [SAT] });
  const r = run([A, B, C, D], ctx({ knownCategoryIds: new Set(["known"]) }));
  assert.notEqual(r.level, "NONE");
  const ids = r.items.map((i) => i.candidate.id);
  assert.ok(ids.includes(A.id));
  assert.equal(r.items[r.items.length - 1]!.candidate.id, A.id);
  assert.equal(r.items.length, 3);
});

// ─── чипы причин и фильтр «Другие идеи» ──────────────────────────────────

test("reason chips: at most two, never «Подходит» for UNKNOWN age", () => {
  const sporty = cand({ interestSlugs: ["sport"], interestBoost: 8, isFree: true });
  const others = [cand(), cand(), cand()];
  const r = run(
    [sporty, ...others],
    ctx({ knownCategoryIds: new Set([sporty, ...others].map((x) => x.categoryId!)) }),
  );
  const item = r.items.find((i) => i.candidate.id === sporty.id)!;
  assert.ok(item.reasonChips.length <= 2);
  assert.equal(item.reasonChips[0], "Подходит: Стёпа");

  const unknownChips = buildReasonChips({
    codes: ["AGE_UNKNOWN", "DATE_WEEKEND", "FREE"],
    matchedChildren: [],
    matchedInterestSlugs: [],
  });
  assert.deepEqual(unknownChips, ["Возраст не указан", "В эти выходные"]);
  assert.ok(unknownChips.every((c) => !c.startsWith("Подходит")));

  assert.deepEqual(buildReasonChips({ codes: ["NEW_CATEGORY", "AGE_MATCH"], matchedChildren: [stepa], matchedInterestSlugs: [] }), [
    "Попробуйте новое",
    "Подходит: Стёпа",
  ]);
  assert.deepEqual(buildReasonChips({ codes: ["POPULAR"], matchedChildren: [], matchedInterestSlugs: [] }), ["Популярно"]);
});

test("age filter keys cover each child with a known age", () => {
  assert.deepEqual(ageFilterKeysForChildren([{ ageMonths: null }]), []);
  const keys = ageFilterKeysForChildren([{ ageMonths: 60 }, { ageMonths: 20 }]);
  assert.ok(keys.length >= 2);
  assert.deepEqual(keys, [...new Set(keys)]);
});
