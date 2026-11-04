import assert from "node:assert/strict";
import test from "node:test";
import { homeRecommendationLabel } from "./homeRecommendationLabel";

const family = { children: [
  { id: "s", name: "Степан", hasBirthDate: true, ageFilter: [] },
  { id: "t", name: "Таисия", hasBirthDate: true, ageFilter: [] },
] };
const event = { agePolicy: "SPECIFIC", ageMinMonths: 36, ageMaxMonths: 144, matchedChildIds: ["s"] };
test("recommendation wording never implies unverified adult suitability", () => {
  assert.equal(homeRecommendationLabel(event, family), "Подходит Степану");
  assert.equal(homeRecommendationLabel({ ...event, matchedChildIds: ["s", "t"] }, family), "Подходит Степану и Таисии");
  assert.equal(homeRecommendationLabel({ ...event, agePolicy: "UNRESTRICTED", matchedChildIds: ["s", "t"] }, family), "Подходит всей семье");
  assert.equal(homeRecommendationLabel({ ...event, agePolicy: "ADULT_ONLY", matchedChildIds: [] }, family), "Подходит вам");
  assert.equal(homeRecommendationLabel({ ...event, ageMinMonths: 216, ageMaxMonths: null, matchedChildIds: [] }, family), "Подходит вам");
  assert.equal(homeRecommendationLabel({ ...event, matchedChildIds: [] }, family), null);
});
