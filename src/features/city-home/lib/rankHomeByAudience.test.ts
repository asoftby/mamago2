import assert from "node:assert/strict";
import test from "node:test";
import { rankHomeByAudience } from "./rankHomeByAudience";
import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";

const adult: FamilyPersona = { id: "me", kind: "adult", displayName: "Я" };
const offers = [
  { id: "children", ageFrom: 1, ageTo: 6, agePolicy: "SPECIFIC" },
  { id: "unknown", ageFrom: null, ageTo: null, agePolicy: "UNKNOWN" },
  { id: "adult", ageFrom: 18, ageTo: 99, agePolicy: "ADULT_ONLY" },
  { id: "everyone", ageFrom: 0, ageTo: 99, agePolicy: "UNRESTRICTED" },
];
const age = (item: typeof offers[number]) => item;

test("adult family selection excludes child and unknown-age offers", () => {
  const result = rankHomeByAudience(offers, { personas: [adult], selectedPersonaIds: [adult.id] }, age);
  assert.deepEqual(result.map(item => item.id), ["adult", "everyone"]);
  assert.equal(result.length, 2);
});

test("manual #nokids behaves as adult intent when nobody is selected", () => {
  const result = rankHomeByAudience(offers, { personas: [adult], selectedPersonaIds: [], manualAgeRanges: ["18+"] }, age);
  assert.deepEqual(result.slice(0, 2).map(item => item.id), ["adult", "everyone"]);
});

test("child age range places matching activities first; free search keeps source order", () => {
  const ageRanked = rankHomeByAudience(offers, { personas: [], selectedPersonaIds: [], manualAgeRanges: ["3-5"] }, age);
  assert.equal(ageRanked[0]?.id, "children");
  assert.deepEqual(rankHomeByAudience(offers, { personas: [], selectedPersonaIds: [] }, age), offers);
});

test("routes use individual selected age tags rather than inventing a continuous range", () => {
  const routes = [
    { id: "split", ageFrom: null, ageTo: null, ageTags: ["3-5", "12-14"] },
    { id: "adult", ageFrom: null, ageTo: null, ageTags: ["18+"] },
  ];
  const result = rankHomeByAudience(routes, { personas: [adult], selectedPersonaIds: [adult.id] }, item => item);
  assert.deepEqual(result.map(item => item.id), ["adult"]);
});

test("notice appears only for an active audience with no matching candidates", async () => {
  const { homeAudienceMatchStatus } = await import("./rankHomeByAudience");
  const audience = { personas: [adult], selectedPersonaIds: [], manualAgeRanges: ["18+"] };
  assert.equal(homeAudienceMatchStatus([offers[0]!], audience, age), "no-items");
  assert.equal(homeAudienceMatchStatus([offers[2]!], audience, age), "match");
  assert.equal(homeAudienceMatchStatus([offers[1]!], audience, age), "no-items");
  assert.equal(homeAudienceMatchStatus([], audience, age), "no-items");
  assert.equal(homeAudienceMatchStatus([offers[0]!], { personas: [], selectedPersonaIds: [] }, age), "no-selection");
});

test("adult-only has a strong match then an age-safe alternative boundary", async () => {
  const { homeAudienceSections } = await import("./rankHomeByAudience");
  const audience = { personas: [adult], selectedPersonaIds: [], manualAgeRanges: ["18+"] };
  const result = homeAudienceSections(offers, audience, age);
  assert.deepEqual(result.primary.map(item => item.id), ["adult"]);
  assert.deepEqual(result.alternatives.map(item => item.id), ["everyone"]);
  assert.equal(result.active, true);
});

test("same adult choice produces stable filtered results on repeated evaluation", () => {
  const audience = { personas: [adult], selectedPersonaIds: [], manualAgeRanges: ["18+"] };
  assert.deepEqual(rankHomeByAudience(offers, audience, age), rankHomeByAudience(offers, audience, age));
});

test("18+ intent preserves open-ended adult offerings but rejects child-only and unknown age", async () => {
  const { homeAudienceSections } = await import("./rankHomeByAudience");
  const values = [
    { id: "adult18", ageFrom: 18, ageTo: null, agePolicy: "SPECIFIC" },
    { id: "adult21", ageFrom: 21, ageTo: null, agePolicy: "SPECIFIC" },
    { id: "child", ageFrom: 3, ageTo: 12, agePolicy: "SPECIFIC" },
    { id: "unknown", ageFrom: null, ageTo: null, agePolicy: "UNKNOWN" },
  ];
  for (const audience of [
    { personas: [adult], selectedPersonaIds: [adult.id] },
    { personas: [adult], selectedPersonaIds: [], manualAgeRanges: ["18+"] },
  ]) {
    assert.deepEqual(rankHomeByAudience(values, audience, item => item).map(item => item.id), ["adult18", "adult21"]);
    const sections = homeAudienceSections(values, audience, item => item);
    assert.deepEqual([...sections.primary, ...sections.alternatives].map(item => item.id), ["adult18", "adult21"]);
    assert.equal(sections.primary[0]?.id, "adult18");
  }
});
