import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  computeLegacyPlanFingerprint,
  computePlanFingerprint,
  matchesScenarioPlanFingerprint,
} from "./dayScenario.service";

const start = new Date("2026-10-01T07:00:00.000Z");
const base = {
  id: "plan-item", activityId: null, routeId: null, placeId: null,
  articleId: null, date: "2026-10-01", startsAt: start,
  endsAt: null, childId: null,
};

test("pre-E1 Scenario hashes remain ready without a schedule change", () => {
  const legacyPart = JSON.stringify({
    id: base.id, activityId: null, routeId: null, placeId: null,
    articleId: null, date: base.date, startsAt: start.toISOString(), overrideStartsAt: null,
  });
  const expected = createHash("sha256")
    .update(JSON.stringify({ items: [legacyPart], acceptedConflictKeys: [] }))
    .digest("hex").slice(0, 32);
  assert.equal(computeLegacyPlanFingerprint([base]), expected);
  assert.notEqual(computePlanFingerprint([base]), expected);
  assert.equal(matchesScenarioPlanFingerprint(expected, [base]), true);
  assert.equal(matchesScenarioPlanFingerprint(expected, [{ ...base, startsAt: new Date("2026-10-01T08:00:00.000Z") }]), false);
});

test("current E1 hash detects start, end, person, and active-set changes", () => {
  const fingerprint = computePlanFingerprint([base]);
  assert.equal(matchesScenarioPlanFingerprint(fingerprint, [base]), true);
  assert.equal(matchesScenarioPlanFingerprint(fingerprint, [{ ...base, startsAt: new Date("2026-10-01T08:00:00.000Z") }]), false);
  assert.equal(matchesScenarioPlanFingerprint(fingerprint, [{ ...base, endsAt: new Date("2026-10-01T08:30:00.000Z") }]), false);
  assert.equal(matchesScenarioPlanFingerprint(fingerprint, [{ ...base, childId: "child-a" }]), false);
  assert.equal(matchesScenarioPlanFingerprint(fingerprint, []), false);
});

test("override and accepted conflicts participate in legacy comparison", () => {
  const overrides = new Map([[base.id, new Date("2026-10-01T09:00:00.000Z")]]);
  const legacy = computeLegacyPlanFingerprint([base], overrides, ["TIME_OVERLAP:a:b"]);
  assert.equal(matchesScenarioPlanFingerprint(legacy, [base], overrides, ["TIME_OVERLAP:a:b"]), true);
  assert.equal(matchesScenarioPlanFingerprint(legacy, [base], new Map(), ["TIME_OVERLAP:a:b"]), false);
});
