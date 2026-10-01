import assert from "node:assert/strict";
import {
  eventSystemInterestSlugs,
  profileInterestScore,
  planSuggestionScore,
  INTEREST_MATCH_WEIGHT,
  MAX_INTEREST_MATCHES,
  PLAN_SUGGESTION_ALGORITHM_VERSION,
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
assert.equal(PLAN_SUGGESTION_ALGORITHM_VERSION, "engagement-profile-interest-v2");
const unchanged = planSuggestionScore({ engagementScore: 7, profileInterestSlugs: [], scheduleJson: scienceEvent });
assert.equal(unchanged.score, 7, "no selected interests preserves v1 score ordering");
assert.deepEqual(unchanged.interestReasonCodes, []);
const matching = planSuggestionScore({ engagementScore: 7, profileInterestSlugs: ["science"], scheduleJson: scienceEvent });
assert.equal(matching.score, 7 + INTEREST_MATCH_WEIGHT);
assert.deepEqual(matching.interestReasonCodes, ["INTEREST_MATCH"]);
const nonmatching = planSuggestionScore({ engagementScore: 7, profileInterestSlugs: ["sport"], scheduleJson: scienceEvent });
assert.equal(nonmatching.score, 7, "nonmatching candidates remain rankable");
assert.deepEqual(nonmatching.interestReasonCodes, []);

console.log("planSuggestions.interests.test.ts: OK");
