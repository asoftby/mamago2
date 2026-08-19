import assert from "node:assert/strict";
import { isPublicHomeStoryItem, stableHomeStoryIdentity, type HomeStoryPolicyItem } from "./homeStoryPolicy";

const now = new Date("2026-08-05T12:00:00.000Z");
const item = (patch: Partial<HomeStoryPolicyItem> = {}): HomeStoryPolicyItem => ({
  id: "stable-placement-id", sourceType: "EVENT", placementType: "AUTO", status: "ACTIVE",
  displayFrom: null, displayUntil: null, ...patch,
});

assert.equal(isPublicHomeStoryItem(item(), now), true);
assert.equal(isPublicHomeStoryItem(item({ sourceType: "OFFER" }), now), false, "Offer is never AUTO");
assert.equal(isPublicHomeStoryItem(item({ sourceType: "OFFER", placementType: "FORCE_INCLUDE" }), now), true);
assert.equal(isPublicHomeStoryItem(item({ placementType: "EXCLUDE" }), now), false);
assert.equal(isPublicHomeStoryItem(item({ status: "INACTIVE", placementType: "FORCE_INCLUDE" }), now), false);
assert.equal(isPublicHomeStoryItem(item({ displayUntil: now }), now), false);
assert.equal(stableHomeStoryIdentity(item()), stableHomeStoryIdentity(item({ placementType: "EXCLUDE" })));
console.log("home story policy tests: OK");
