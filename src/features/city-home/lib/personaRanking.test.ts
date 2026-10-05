import assert from "node:assert/strict";
import test from "node:test";
import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";
import type { ActivityMock } from "@/types/activity";
import { applyPersonaRanking } from "./personaRanking";

function activity(
  id: string,
  agePolicy: ActivityMock["agePolicy"],
  ageFrom: number,
  ageTo: number,
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
    engagementScore: 10,
  };
}

function adult(id = "adult"): FamilyPersona {
  return {
    id,
    kind: "adult",
    displayName: "Я",
  };
}

function child(id: string, ageYears: number): FamilyPersona {
  const now = new Date();
  const birthDate = new Date(
    now.getFullYear() - ageYears,
    0,
    1,
    12,
    0,
    0,
  ).toISOString();

  return {
    id,
    kind: "child",
    displayName: id,
    birthDate,
  };
}

test("only adult selection filters child-only events before ranking", () => {
  const me = adult();
  const result = applyPersonaRanking(
    [
      activity("zero-to-18", "SPECIFIC", 0, 18),
      activity("five-to-18", "SPECIFIC", 5, 18),
      activity("adult-range", "SPECIFIC", 18, 99),
      activity("strict", "ADULT_ONLY", 18, 99),
      activity("unrestricted", "UNRESTRICTED", 0, 12),
    ],
    {
      personas: [me],
      selectedPersonaIds: [me.id],
    },
  );

  assert.deepEqual(
    result.map((item) => item.id).sort(),
    ["adult-range", "strict", "unrestricted"],
  );
});

test("adult accompanying a child does not broaden eligibility to adult-only content", () => {
  const me = adult();
  const kid = child("kid", 6);
  const result = applyPersonaRanking(
    [
      activity("strict-adult", "ADULT_ONLY", 18, 99),
      activity("adult-range", "SPECIFIC", 18, 99),
      activity("kid", "SPECIFIC", 5, 7),
      activity("family", "SPECIFIC", 5, 99),
      activity("unrestricted", "UNRESTRICTED", 0, 12),
    ],
    {
      personas: [me, kid],
      selectedPersonaIds: [me.id, kid.id],
    },
  );

  assert.deepEqual(
    result.map((item) => item.id).sort(),
    ["family", "kid", "unrestricted"],
  );
});

test("two selected children require an event that suits both exact ages", () => {
  const younger = child("younger", 4);
  const older = child("older", 9);
  const result = applyPersonaRanking(
    [
      activity("young-only", "SPECIFIC", 3, 5),
      activity("older-only", "SPECIFIC", 8, 12),
      activity("both", "SPECIFIC", 3, 12),
      activity("unrestricted", "UNRESTRICTED", 0, 12),
    ],
    {
      personas: [younger, older],
      selectedPersonaIds: [younger.id, older.id],
    },
  );

  assert.deepEqual(
    result.map((item) => item.id).sort(),
    ["both", "unrestricted"],
  );
});

test("no selected personas preserves the unfiltered list", () => {
  const activities = [
    activity("kid", "SPECIFIC", 3, 7),
    activity("adult", "ADULT_ONLY", 18, 99),
  ];

  assert.deepEqual(
    applyPersonaRanking(activities, {
      personas: [],
      selectedPersonaIds: [],
    }),
    activities,
  );
});


test("selected child without birth date does not admit numeric specific ranges", () => {
  const kid: FamilyPersona = {
    id: "unknown-age",
    kind: "child",
    displayName: "Ребёнок",
    birthDate: null,
  };

  const result = applyPersonaRanking(
    [
      activity("adult-range", "SPECIFIC", 18, 99),
      activity("child-range", "SPECIFIC", 3, 7),
      activity("unrestricted", "UNRESTRICTED", 0, 12),
    ],
    {
      personas: [kid],
      selectedPersonaIds: [kid.id],
    },
  );

  assert.deepEqual(result.map((item) => item.id), ["unrestricted"]);
});
