import assert from "node:assert/strict";
import test from "node:test";
import { homeRecommendationLabel } from "./homeRecommendationLabel";

const family = { children: [
  { id: "s", name: "Степан", hasBirthDate: true, ageFilter: [] },
  { id: "t", name: "Тая", hasBirthDate: true, ageFilter: [] },
] };
const event = { agePolicy: "SPECIFIC", ageMinMonths: 36, ageMaxMonths: 144, matchedChildIds: ["s"] };
test("age fit alone never produces a personal badge", () => {
  assert.equal(homeRecommendationLabel(event, family), null);
  assert.equal(homeRecommendationLabel({ ...event, agePolicy: "UNRESTRICTED", matchedChildIds: ["s", "t"] }, family), null);
  assert.equal(homeRecommendationLabel({ ...event, agePolicy: "ADULT_ONLY", matchedChildIds: [] }, family), null);
});
test("only server-confirmed individual interests appear, never inferred adults", () => {
  assert.equal(homeRecommendationLabel({ ...event, matchBadgeChildIds: ["s"] }, family), "Подходит Степану");
  assert.equal(homeRecommendationLabel({ ...event, matchedChildIds: ["s", "t"], matchBadgeChildIds: ["s", "t"] }, family), "Подходит Степану и Тае");
  assert.equal(homeRecommendationLabel({ ...event, agePolicy: "UNRESTRICTED", matchedChildIds: ["s", "t"], matchBadgeChildIds: ["s"] }, family), "Подходит Степану");
  assert.equal(homeRecommendationLabel({ ...event, matchBadgeChildIds: ["other"] }, family), null);
});
