import assert from "node:assert/strict";
import test from "node:test";
import { defaultFilters } from "@/features/filters/discovery/filters.store";
import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";
import type { ActivityMock } from "@/types/activity";
import { partitionDiscoveryFeed } from "./partitionDiscoveryFeed";

function activity(
  id: string,
  agePolicy: ActivityMock["agePolicy"],
  ageFrom: number,
  ageTo: number,
  engagementScore = 10,
): ActivityMock {
  return {
    id,
    agePolicy,
    ageFrom,
    ageTo,
    type: "EVENT_FIXED",
    title: id,
    description: id,
    image: "/x.jpg",
    currency: "BYN",
    tags: [],
    engagementScore,
  };
}

function adult(id = "adult"): FamilyPersona {
  return { id, kind: "adult", displayName: "Я" };
}

function child(id: string, ageYears: number): FamilyPersona {
  const now = new Date();
  return {
    id,
    kind: "child",
    displayName: id,
    birthDate: new Date(now.getFullYear() - ageYears, 0, 1, 12).toISOString(),
  };
}

test("child context excludes ADULT_ONLY and keeps unrestricted", () => {
  const kid = child("kid", 4);
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["3-5"] },
    [
      activity("adult", "ADULT_ONLY", 18, 99),
      activity("any", "UNRESTRICTED", 0, 12),
    ],
    { personas: [kid], selectedPersonaIds: [kid.id] },
  );
  assert.deepEqual(result.primary.map((item) => item.id), ["any"]);
  assert.equal(result.secondary.some((item) => item.id === "adult"), false);
});

test("adult self context rejects child ranges ending at 18", () => {
  const me = adult();
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["18+"] },
    [
      activity("unrestricted", "UNRESTRICTED", 0, 12),
      activity("specific-18", "SPECIFIC", 18, 99),
      activity("strict", "ADULT_ONLY", 18, 99),
      activity("zero-to-18", "SPECIFIC", 0, 18),
      activity("five-to-18", "SPECIFIC", 5, 18),
      activity("sixteen-to-18", "SPECIFIC", 16, 18),
      activity("kids", "SPECIFIC", 3, 7),
    ],
    { personas: [me], selectedPersonaIds: [me.id] },
  );

  assert.deepEqual(
    result.primary.map((item) => item.id).sort(),
    ["specific-18", "strict", "unrestricted"],
  );
  assert.deepEqual(result.secondary, []);
  assert.equal(result.secondaryHeading, null);
});

test("manual multi-select age chips preserve OR semantics", () => {
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["3-5", "9-12"] },
    [
      activity("young", "SPECIFIC", 3, 5),
      activity("older", "SPECIFIC", 9, 12),
      activity("both", "SPECIFIC", 3, 12),
    ],
  );

  assert.deepEqual(
    result.primary.map((item) => item.id).sort(),
    ["both", "older", "young"],
  );
});

test("manual 18+ chip does not include teen ranges ending at 18", () => {
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["18+"] },
    [
      activity("teen", "SPECIFIC", 5, 18),
      activity("adult", "SPECIFIC", 18, 99),
      activity("any", "UNRESTRICTED", 0, 12),
    ],
  );

  assert.deepEqual(
    result.primary.map((item) => item.id).sort(),
    ["adult", "any"],
  );
});

test("UNKNOWN age does not become a child match through numeric fallback", () => {
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["3-5"] },
    [activity("unknown", "UNKNOWN", 0, 12, 3)],
  );

  assert.deepEqual(result.primary, []);
  assert.deepEqual(result.secondary, []);
});

test("adult plus child context uses child eligibility and does not broaden to 18+", () => {
  const me = adult();
  const kid = child("kid-persona", 6);
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["5-7", "18+"] },
    [
      activity("strict-adult", "ADULT_ONLY", 18, 99),
      activity("specific-adult", "SPECIFIC", 18, 99),
      activity("kid", "SPECIFIC", 5, 7),
      activity("family", "SPECIFIC", 5, 99),
      activity("unrestricted", "UNRESTRICTED", 0, 12),
    ],
    { personas: [me, kid], selectedPersonaIds: [me.id, kid.id] },
  );

  assert.deepEqual(
    result.primary.map((item) => item.id).sort(),
    ["family", "kid", "unrestricted"],
  );
});

test("multiple selected children require exact compatibility for every child", () => {
  const younger = child("younger", 4);
  const older = child("older", 10);
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["3-5", "9-12"] },
    [
      activity("young-only", "SPECIFIC", 3, 5),
      activity("both", "SPECIFIC", 3, 12),
      activity("unrestricted", "UNRESTRICTED", 0, 12),
    ],
    {
      personas: [younger, older],
      selectedPersonaIds: [younger.id, older.id],
    },
  );

  assert.deepEqual(
    result.primary.map((item) => item.id).sort(),
    ["both", "unrestricted"],
  );
});

test("selected child without birth date only safely matches unrestricted content", () => {
  const kid: FamilyPersona = {
    id: "unknown-age",
    kind: "child",
    displayName: "Ребёнок",
    birthDate: null,
  };
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: [] },
    [
      activity("adult-range", "SPECIFIC", 18, 99),
      activity("child-range", "SPECIFIC", 3, 7),
      activity("any", "UNRESTRICTED", 0, 12),
    ],
    { personas: [kid], selectedPersonaIds: [kid.id] },
  );

  assert.deepEqual(result.primary.map((item) => item.id), ["any"]);
});

test("popular secondary remains available for child persona contexts", () => {
  const kid = child("kid", 4);
  const result = partitionDiscoveryFeed(
    { ...defaultFilters, age: ["3-5"] },
    [
      activity("one-detail-open", "SPECIFIC", 9, 12, 2),
      activity("saved", "SPECIFIC", 9, 12, 4),
    ],
    { personas: [kid], selectedPersonaIds: [kid.id] },
  );

  assert.deepEqual(result.secondary.map((item) => item.id), ["saved"]);
  assert.equal(result.secondaryHeading, "Популярное у других семей");
});
