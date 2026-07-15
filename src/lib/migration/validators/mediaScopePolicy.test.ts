import assert from "node:assert/strict";

import { APPROVED_MEDIA_SCOPES, evaluateMediaScope, isApprovedMediaScope } from "./mediaScopePolicy";
import type { MigrationMediaScope } from "../types";

const expectedApprovedScopes: readonly MigrationMediaScope[] = [
  "USER_PROFILE",
  "BUSINESS_PROFILE",
  "PLACE",
  "ARTICLE",
  "OFFER_SERVICES",
  "OFFER_PROGRAMS",
  "ROUTE",
  "EVENT",
];

assert.deepEqual(APPROVED_MEDIA_SCOPES, expectedApprovedScopes);

for (const scope of expectedApprovedScopes) {
  assert.equal(isApprovedMediaScope(scope), true);
  assert.deepEqual(evaluateMediaScope(scope), { scope, allowed: true });
}

// Every real `MigrationMediaScope` value is approved today — Event media
// was blocked until the sampled media policy PR (2026-07-15), which
// retired `EVENT_BLOCKED` in favor of `EVENT`. `evaluateMediaScope`'s
// not-approved branch is defensive for any future scope addition that
// hasn't been approved yet; this test exercises it with an unsafe cast
// since no real unapproved scope exists to reach for.
const hypotheticalFutureScope = "OFFER_HYPOTHETICAL_FUTURE_SCOPE" as unknown as MigrationMediaScope;
assert.equal(isApprovedMediaScope(hypotheticalFutureScope), false);

const decision = evaluateMediaScope(hypotheticalFutureScope);
assert.equal(decision.allowed, false);
assert.equal(decision.warning?.code, "MEDIA_SCOPE_NOT_APPROVED");
assert.equal(decision.warning?.details?.scope, hypotheticalFutureScope);

console.log("migration media scope policy tests: OK");
