import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLIC_DISCOVERY_OCCASION_TYPES,
  activeOccasionWhere,
  publicDiscoveryOccasionWhere,
  isOccasionCurrentlyActive,
  isOccasionWithinActiveWindow,
} from "./occasionUtils";

const configured = {
  isActive: true,
  autoSuggest: false,
  startsAt: new Date("2026-10-15T00:00:00.000Z"),
  endsAt: new Date("2026-11-01T23:59:59.999Z"),
};

test("public occasion visibility is defined only by admin status and inclusive period", () => {
  assert.equal(isOccasionWithinActiveWindow(configured, configured.startsAt), true);
  assert.equal(isOccasionWithinActiveWindow(configured, configured.endsAt), true);
  assert.equal(isOccasionWithinActiveWindow(configured, new Date("2026-11-08T12:00:00.000Z")), false);
  assert.equal(isOccasionWithinActiveWindow({ ...configured, isActive: false }, configured.startsAt), false);
  assert.equal(isOccasionWithinActiveWindow({ ...configured, startsAt: null }, configured.endsAt), false);
  assert.equal(isOccasionWithinActiveWindow({ ...configured, endsAt: null }, configured.startsAt), false);
  assert.equal(isOccasionWithinActiveWindow(null, configured.startsAt), false);
});

test("autoSuggest only controls editor suggestion, not public display", () => {
  assert.equal(isOccasionCurrentlyActive(configured, configured.startsAt), false);
  assert.equal(isOccasionCurrentlyActive({ ...configured, autoSuggest: true }, configured.startsAt), true);
});

test("query predicate and in-memory checks use the same inclusive dates", () => {
  const now = new Date("2026-11-08T12:00:00.000Z");
  assert.deepEqual(activeOccasionWhere(now), {
    isActive: true,
    startsAt: { lte: now },
    endsAt: { gte: now },
  });
});

test("public discovery excludes family occasions even when active for many years", () => {
  const now = new Date("2026-11-08T12:00:00.000Z");
  assert.deepEqual(PUBLIC_DISCOVERY_OCCASION_TYPES, ["HOLIDAY", "SEASON", "EVENT"]);
  assert.deepEqual(publicDiscoveryOccasionWhere(now), {
    ...activeOccasionWhere(now),
    type: { in: ["HOLIDAY", "SEASON", "EVENT"] },
  });
  // Birthday remains a valid FAMILY occasion for editor/birthday flows.
  assert.equal(isOccasionWithinActiveWindow({
    isActive: true,
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    endsAt: new Date("2036-12-31T23:59:59.999Z"),
  }, now), true);
});
