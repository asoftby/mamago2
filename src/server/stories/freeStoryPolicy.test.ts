import assert from "node:assert/strict";
import { isFreeStoryCandidate, type FreeStoryCandidate } from "./freeStoryPolicy";

const range = {
  from: new Date("2026-08-05T00:00:00.000Z"),
  until: new Date("2026-08-12T00:00:00.000Z"),
  now: new Date("2026-08-05T12:00:00.000Z"),
};
const candidate = (patch: Partial<FreeStoryCandidate> = {}): FreeStoryCandidate => ({
  id: "shared-home-story-id",
  sourceType: "EVENT",
  placementType: "AUTO",
  status: "ACTIVE",
  isFree: true,
  startsAt: new Date("2026-08-06T12:00:00.000Z"),
  storyDate: new Date("2026-08-06T00:00:00.000Z"),
  ...patch,
});

assert.equal(isFreeStoryCandidate(candidate(), range), true);
assert.equal(isFreeStoryCandidate(candidate({ isFree: false }), range), false);
assert.equal(isFreeStoryCandidate(candidate({ sourceType: "OFFER", placementType: "FORCE_INCLUDE" }), range), false);
assert.equal(isFreeStoryCandidate(candidate({ placementType: "EXCLUDE" }), range), false);
assert.equal(isFreeStoryCandidate(candidate({ status: "INACTIVE" }), range), false);
assert.equal(isFreeStoryCandidate(candidate({ startsAt: new Date("2026-08-05T11:59:00.000Z") }), range), false);
assert.equal(isFreeStoryCandidate(candidate({ startsAt: range.until, storyDate: range.until }), range), false);
assert.equal(candidate().id, candidate({ isFree: false }).id, "intent membership does not change placement identity");
console.log("free story policy tests: OK");
