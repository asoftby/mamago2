import assert from "node:assert/strict";
import type { Prisma, UserEventType } from "@prisma/client";
import type { Subject } from "@/lib/decision/decisionContext";
import {
  AFFINITY_KEY_MAX,
  buildSelectedExperienceAffinity,
  experienceOutcomeDelta,
  scoreCandidateExperienceAffinity,
} from "./experienceAffinity";
import {
  INTEREST_MATCH_WEIGHT,
  PLAN_SUGGESTION_ALGORITHM_VERSION,
  planSuggestionScore,
} from "@/server/services/planSuggestions.service";
import { ENGAGEMENT_WEIGHTS } from "@/server/discovery/engagementWeights";
import { BEHAVIOR_AFFINITY_WEIGHTS } from "./behaviorSignalWeights";

const childA: Subject = { kind: "child", refId: "child-A-123", source: "profile" };
const childB: Subject = { kind: "child", refId: "child-B-123", source: "profile" };
const adult: Subject = { kind: "adult", refId: "adult-123", source: "profile" };
const manual: Subject = { kind: "child", refId: null, ageRange: "5-7", source: "manual" };

function event(
  eventType: UserEventType,
  subjects: unknown[],
  sentiment?: unknown,
  semantics: Record<string, unknown> = {},
) {
  return {
    eventType,
    meta: {
      subjects,
      ...(sentiment === undefined ? {} : { sentiment }),
      categoryIds: ["category-science"],
      signalIds: ["signal-educational"],
      format: "OFFLINE",
      interestSlugs: ["science", "unknown-custom"],
      ...semantics,
    } as Prisma.JsonValue,
  };
}

assert.equal(experienceOutcomeDelta("ATTENDED"), 2);
assert.equal(experienceOutcomeDelta("EXPERIENCE_FEEDBACK", "LIKE"), 5);
assert.equal(experienceOutcomeDelta("EXPERIENCE_FEEDBACK", "NEUTRAL"), 0);
assert.equal(experienceOutcomeDelta("EXPERIENCE_FEEDBACK", "DISLIKE"), -7);
assert.equal(experienceOutcomeDelta("EXPERIENCE_FEEDBACK", "LOVED"), 0);
assert.equal(experienceOutcomeDelta("PLAN_ADD"), 0);

const candidate = {
  categoryId: "category-science",
  signalIds: ["signal-educational"],
  format: "OFFLINE",
  interestSlugs: ["science"],
};
const aPositive = buildSelectedExperienceAffinity(
  [childA],
  [event("ATTENDED", [childA]), event("EXPERIENCE_FEEDBACK", [childA], "LIKE")],
);
assert.deepEqual(scoreCandidateExperienceAffinity(aPositive, candidate), {
  experienceAffinityBoost: 6,
  experienceMatchedSubjectCount: 1,
});
assert.equal(
  scoreCandidateExperienceAffinity(buildSelectedExperienceAffinity([childB], [event("ATTENDED", [childA])]), candidate)
    .experienceAffinityBoost,
  0,
  "child A history never leaks to child B",
);
assert.equal(
  scoreCandidateExperienceAffinity(buildSelectedExperienceAffinity([childA, childB], [event("ATTENDED", [childA])]), candidate)
    .experienceAffinityBoost,
  2,
  "a selected sibling without evidence does not dilute or amplify A",
);

const conflicting = buildSelectedExperienceAffinity(
  [childA, childB],
  [
    event("ATTENDED", [childA]),
    event("EXPERIENCE_FEEDBACK", [childA], "LIKE"),
    event("ATTENDED", [childB]),
    event("EXPERIENCE_FEEDBACK", [childB], "DISLIKE"),
  ],
);
assert.equal(scoreCandidateExperienceAffinity(conflicting, candidate).experienceAffinityBoost, 0.5);

const attendedOnly = buildSelectedExperienceAffinity([childA], [event("ATTENDED", [childA])]);
const neutral = buildSelectedExperienceAffinity(
  [childA],
  [event("ATTENDED", [childA]), event("EXPERIENCE_FEEDBACK", [childA], "NEUTRAL")],
);
const disliked = buildSelectedExperienceAffinity(
  [childA],
  [event("ATTENDED", [childA]), event("EXPERIENCE_FEEDBACK", [childA], "DISLIKE")],
);
assert.equal(scoreCandidateExperienceAffinity(attendedOnly, candidate).experienceAffinityBoost, 2);
assert.equal(scoreCandidateExperienceAffinity(neutral, candidate).experienceAffinityBoost, 2);
assert.equal(scoreCandidateExperienceAffinity(disliked, candidate).experienceAffinityBoost, -5);

const samePositiveForTwo = buildSelectedExperienceAffinity(
  [childA, childB],
  [event("ATTENDED", [childA, childB]), event("EXPERIENCE_FEEDBACK", [childA, childB], "LIKE")],
);
assert.equal(scoreCandidateExperienceAffinity(samePositiveForTwo, candidate).experienceAffinityBoost, 6);

const tagCount = buildSelectedExperienceAffinity(
  [childA],
  [event("ATTENDED", [childA], undefined, { signalIds: ["s1", "s2", "s3", "s4", "s5"] })],
);
assert.equal(
  scoreCandidateExperienceAffinity(tagCount, { signalIds: ["s1"] }).experienceAffinityBoost,
  scoreCandidateExperienceAffinity(tagCount, { signalIds: ["s1", "s2", "s3", "s4", "s5"] }).experienceAffinityBoost,
);

const clamped = buildSelectedExperienceAffinity(
  [childA],
  Array.from({ length: 20 }, () => event("EXPERIENCE_FEEDBACK", [childA], "LIKE")),
);
assert.equal(clamped.subjects[0]?.interestScores.get("science"), AFFINITY_KEY_MAX);

for (const noPersonalization of [
  buildSelectedExperienceAffinity([], [event("ATTENDED", [childA])]),
  buildSelectedExperienceAffinity([manual], [event("ATTENDED", [manual])]),
  buildSelectedExperienceAffinity([childA], [event("ATTENDED", [{ broken: true }])]),
  buildSelectedExperienceAffinity([childA], [event("ATTENDED", [childA], undefined, {
    categoryIds: [], signalIds: [], format: null, interestSlugs: [],
  })]),
]) {
  assert.equal(scoreCandidateExperienceAffinity(noPersonalization, candidate).experienceAffinityBoost, 0);
}

const adultAffinity = buildSelectedExperienceAffinity([adult], [event("ATTENDED", [adult])]);
assert.equal(scoreCandidateExperienceAffinity(adultAffinity, candidate).experienceAffinityBoost, 2);

const combined = planSuggestionScore({
  engagementScore: 1,
  profileInterestSlugs: ["science"],
  scheduleJson: { signals: { interests: ["science"] } },
  categoryId: candidate.categoryId,
  discoverySignalIds: candidate.signalIds,
  format: candidate.format,
  experienceAffinity: aPositive,
});
assert.equal(combined.score, 1 + INTEREST_MATCH_WEIGHT + 6);
assert.deepEqual(combined.experienceReasonCodes, ["EXPERIENCE_POSITIVE"]);
const negative = planSuggestionScore({
  engagementScore: 20,
  profileInterestSlugs: [],
  scheduleJson: { signals: { interests: ["science"] } },
  categoryId: candidate.categoryId,
  discoverySignalIds: candidate.signalIds,
  format: candidate.format,
  experienceAffinity: disliked,
});
assert.equal(negative.score, 15, "DISLIKE demotes but never filters the candidate");
assert.deepEqual(negative.experienceReasonCodes, ["EXPERIENCE_NEGATIVE"]);
assert.equal(PLAN_SUGGESTION_ALGORITHM_VERSION, "engagement-profile-interest-experience-v3");
assert.equal(ENGAGEMENT_WEIGHTS.ATTENDED, undefined);
assert.equal(ENGAGEMENT_WEIGHTS.EXPERIENCE_FEEDBACK, undefined);
assert.equal(BEHAVIOR_AFFINITY_WEIGHTS.ATTENDED, undefined);
assert.equal(BEHAVIOR_AFFINITY_WEIGHTS.EXPERIENCE_FEEDBACK, undefined);

console.log("experienceAffinity.test.ts: OK");
