import assert from "node:assert/strict";
import test from "node:test";
import { isOccasionWithinActiveWindow } from "./activeHalloweenOccasion";

const activeHalloween = {
  isActive: true,
  startsAt: new Date("2026-10-15T00:00:00.000Z"),
  endsAt: new Date("2026-11-01T23:59:59.999Z"),
};

test("Halloween occasion appears on home and listing within configured active dates", () => {
  assert.equal(isOccasionWithinActiveWindow(activeHalloween, new Date("2026-10-26T12:00:00Z")), true);
  assert.equal(isOccasionWithinActiveWindow(activeHalloween, activeHalloween.startsAt), true);
  assert.equal(isOccasionWithinActiveWindow(activeHalloween, activeHalloween.endsAt), true);
});

test("Disabled, missing, incomplete and expired occasions are hidden", () => {
  assert.equal(isOccasionWithinActiveWindow(activeHalloween, new Date("2026-10-14T23:59:59Z")), false);
  assert.equal(isOccasionWithinActiveWindow(activeHalloween, new Date("2026-11-02T00:00:00Z")), false);
  assert.equal(isOccasionWithinActiveWindow({ ...activeHalloween, isActive: false }, new Date("2026-10-26")), false);
  assert.equal(isOccasionWithinActiveWindow({ ...activeHalloween, startsAt: null }, new Date("2026-10-26")), false);
  assert.equal(isOccasionWithinActiveWindow(null, new Date("2026-10-26")), false);
});
