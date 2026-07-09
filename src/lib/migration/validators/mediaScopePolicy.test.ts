import assert from "node:assert/strict";

import {
  APPROVED_MEDIA_SCOPES,
  BLOCKED_EVENT_MEDIA_POLICY,
  evaluateMediaScope,
  isApprovedMediaScope,
} from "./mediaScopePolicy";
import type { MigrationMediaScope } from "../types";

const expectedApprovedScopes: readonly MigrationMediaScope[] = [
  "USER_PROFILE",
  "BUSINESS_PROFILE",
  "PLACE",
  "ARTICLE",
  "OFFER_SERVICES",
  "OFFER_PROGRAMS",
  "ROUTE",
];

assert.deepEqual(APPROVED_MEDIA_SCOPES, expectedApprovedScopes);

for (const scope of expectedApprovedScopes) {
  assert.equal(isApprovedMediaScope(scope), true);
  assert.deepEqual(evaluateMediaScope(scope), { scope, allowed: true });
}

assert.equal(isApprovedMediaScope("EVENT_BLOCKED"), false);

const eventMediaDecision = evaluateMediaScope("EVENT_BLOCKED");
assert.equal(eventMediaDecision.allowed, false);
assert.equal(eventMediaDecision.warning?.code, BLOCKED_EVENT_MEDIA_POLICY.reasonCode);
assert.equal(eventMediaDecision.warning?.details?.scope, "EVENT_BLOCKED");

console.log("migration media scope policy tests: OK");
