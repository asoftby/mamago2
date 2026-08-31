import * as assert from "node:assert/strict";

import { haversineMeters } from "./haversineMeters";

// Same point → zero distance.
assert.equal(haversineMeters(53.9, 27.5667, 53.9, 27.5667), 0, "identical points are 0m apart");

// Symmetry.
const a = { lat: 53.9006, lng: 27.5590 };
const b = { lat: 53.8935, lng: 27.5666 };
assert.equal(
  haversineMeters(a.lat, a.lng, b.lat, b.lng),
  haversineMeters(b.lat, b.lng, a.lat, a.lng),
  "distance is symmetric",
);

// Known reference distance: Minsk city-center-ish points ~1km apart (loose tolerance,
// this is a sanity check on the formula, not a precision benchmark).
const distance = haversineMeters(a.lat, a.lng, b.lat, b.lng);
assert.ok(distance > 800 && distance < 1200, `expected ~1km, got ${distance}m`);

// Sub-meter drift should report a small but nonzero distance, not 0 or NaN.
const driftDistance = haversineMeters(53.9, 27.5667, 53.900004, 27.5667);
assert.ok(driftDistance > 0 && driftDistance < 1, `expected sub-meter drift, got ${driftDistance}m`);

console.log("haversineMeters tests: OK");
