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

test("family scoring never removes items outside selected ages", () => {
  const me = adult();
  const kid = child("kid", 6);
  const candidates = [
    activity("strict-adult", "ADULT_ONLY", 18, 99),
    activity("young-only", "SPECIFIC", 0, 3),
    activity("school", "SPECIFIC", 6, 12),
    activity("unknown", "UNRESTRICTED", 0, 99),
  ];
  for (const selectedPersonaIds of [[me.id], [kid.id], [me.id, kid.id], []]) {
    const ranked = applyPersonaRanking(candidates, {
      personas: [me, kid],
      selectedPersonaIds,
    });
    assert.deepEqual(
      ranked.map((item) => item.id).sort(),
      candidates.map((item) => item.id).sort(),
    );
  }
});

test("multiple children use a union of interests instead of age intersection", () => {
  const children = [child("younger", 4), child("older", 9)];
  const candidates = [
    activity("young-only", "SPECIFIC", 3, 5),
    activity("older-only", "SPECIFIC", 8, 12),
    activity("all", "SPECIFIC", 3, 12),
  ];
  const ranked = applyPersonaRanking(candidates, {
    personas: children,
    selectedPersonaIds: children.map((c) => c.id),
  });
  assert.deepEqual(new Set(ranked.map((a) => a.id)), new Set(candidates.map((a) => a.id)));
});

test("no selected personas preserves original order", () => {
  const candidates = [activity("kid", "SPECIFIC", 3, 7), activity("adult", "ADULT_ONLY", 18, 99)];
  assert.deepEqual(applyPersonaRanking(candidates, { personas: [], selectedPersonaIds: [] }), candidates);
});
