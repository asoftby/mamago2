import assert from "node:assert/strict";
import {
  eventSystemInterestSlugs,
  profileInterestScore,
  planSuggestionScore,
  INTEREST_MATCH_WEIGHT,
  MAX_INTEREST_MATCHES,
  PLAN_SUGGESTION_ALGORITHM_VERSION,
  confirmedPlanOccurrencesWhere,
  planSuggestionCandidateTake,
} from "./planSuggestions.service";

const scienceEvent = { signals: { interests: ["science"] } };

assert.deepEqual(profileInterestScore([], scienceEvent), {
  interestMatchCount: 0,
  interestBoost: 0,
});
assert.deepEqual(profileInterestScore(["science"], scienceEvent), {
  interestMatchCount: 1,
  interestBoost: INTEREST_MATCH_WEIGHT,
});
assert.deepEqual(profileInterestScore(["science"], { signals: { interests: [] } }), {
  interestMatchCount: 0,
  interestBoost: 0,
});
assert.deepEqual(
  eventSystemInterestSlugs({ signals: { interests: ["science", "science", "not-canonical", 7] } }),
  ["science"],
);
assert.deepEqual(
  profileInterestScore(
    ["science", "sport", "music", "science"],
    { signals: { interests: ["science", "sport", "music"] } },
  ),
  {
    interestMatchCount: MAX_INTEREST_MATCHES,
    interestBoost: MAX_INTEREST_MATCHES * INTEREST_MATCH_WEIGHT,
  },
);
assert.equal(PLAN_SUGGESTION_ALGORITHM_VERSION, "engagement-profile-interest-experience-v3");
const unchanged = planSuggestionScore({ engagementScore: 7, profileInterestSlugs: [], scheduleJson: scienceEvent });
assert.equal(unchanged.score, 7, "no selected interests preserves v1 score ordering");
assert.deepEqual(unchanged.interestReasonCodes, []);
const matching = planSuggestionScore({ engagementScore: 7, profileInterestSlugs: ["science"], scheduleJson: scienceEvent });
assert.equal(matching.score, 7 + INTEREST_MATCH_WEIGHT);
assert.deepEqual(matching.interestReasonCodes, ["INTEREST_MATCH"]);
const nonmatching = planSuggestionScore({ engagementScore: 7, profileInterestSlugs: ["sport"], scheduleJson: scienceEvent });
assert.equal(nonmatching.score, 7, "nonmatching candidates remain rankable");
assert.deepEqual(nonmatching.interestReasonCodes, []);

// Dated recommendations must filter verified future sessions before the top-N
// ranking cap; generic ALWAYS availability is not a booked time.
const start = new Date("2026-11-03T00:00:00Z");
const end = new Date("2026-11-04T00:00:00Z");
const now = new Date("2026-11-03T12:00:00Z");
const confirmed = confirmedPlanOccurrencesWhere({ start, end }, now);
assert.deepEqual(confirmed, {
  OR: [
    { sessions: { some: { startsAt: { gte: now, lt: end }, withdrawnAt: null } } },
    { AND: [
      { sessions: { none: {} } },
      { nextOccurrenceAt: { gte: now, lt: end } },
    ] },
  ],
});

console.log("planSuggestions.interests.test.ts: OK");

// Regression: HOME with 30-day exhaustive ranking must not lose an eligible
// future event merely because it occurs after the first 120 SQL rows.
assert.equal(planSuggestionCandidateTake({ exhaustiveCandidatePool: true, homeGeoFallback: true, externalGeo: false, take: 10 }), undefined);
assert.equal(planSuggestionCandidateTake({ exhaustiveCandidatePool: true, homeGeoFallback: false, externalGeo: false, take: 10 }), undefined);
assert.equal(planSuggestionCandidateTake({ exhaustiveCandidatePool: true, homeGeoFallback: true, externalGeo: true, take: 10 }), 24);
assert.equal(planSuggestionCandidateTake({ exhaustiveCandidatePool: false, homeGeoFallback: true, externalGeo: false, take: 10 }), 120);
assert.equal(planSuggestionCandidateTake({ exhaustiveCandidatePool: false, homeGeoFallback: false, externalGeo: false, take: 3 }), 24);
assert.equal(planSuggestionCandidateTake({ exhaustiveCandidatePool: false, homeGeoFallback: false, externalGeo: false, take: 30 }), 80);
