import assert from "node:assert/strict";
import {
  decodeGeohashBounds,
  encodeGeohash,
  geoCellsFor,
  geoCellWithNeighbors,
  isValidLatLng,
} from "./geoCell";

// Reference vectors (geohash.org / Wikipedia).
assert.equal(encodeGeohash(57.64911, 10.40744, 11), "u4pruydqqvj");
assert.equal(encodeGeohash(42.6, -5.6, 5), "ezs42");

// Minsk centre: both levels share a prefix and have the expected lengths.
const minsk = geoCellsFor(53.9006, 27.5590);
assert.ok(minsk);
assert.equal(minsk.geoCell6.length, 6);
assert.equal(minsk.geoCell5.length, 5);
assert.ok(minsk.geoCell6.startsWith(minsk.geoCell5));
assert.ok(minsk.geoCell6.startsWith("u9"), "Minsk lies in the u9 geohash region");

// Decode round trip: the encoded cell contains the point.
const b = decodeGeohashBounds(minsk.geoCell6);
assert.ok(b.latMin <= 53.9006 && 53.9006 <= b.latMax);
assert.ok(b.lngMin <= 27.559 && 27.559 <= b.lngMax);

// Unusable coordinates produce no cells.
for (const [lat, lng] of [[null, 1], [1, undefined], [NaN, 1], [91, 0], [0, 181], [0, 0], ["1", "2"]] as const) {
  assert.equal(geoCellsFor(lat, lng), null, `${String(lat)},${String(lng)}`);
  assert.equal(isValidLatLng(lat, lng), false);
}

// Neighbours: 9 distinct cells for a mid-latitude cell, all same precision, include self.
const ring = geoCellWithNeighbors(minsk.geoCell6);
assert.equal(ring.length, 9);
assert.ok(ring.includes(minsk.geoCell6));
assert.ok(ring.every((c) => c.length === 6));

// Two points ~300 m apart fall in the same or adjacent geoCell6.
const near = geoCellsFor(53.9031, 27.5590)!;
assert.ok(ring.includes(near.geoCell6) || geoCellWithNeighbors(near.geoCell6).includes(minsk.geoCell6));

// Poles/antimeridian never throw and stay in range.
assert.ok(geoCellWithNeighbors(encodeGeohash(89.99, 179.99, 5)).length >= 6);
assert.ok(geoCellWithNeighbors(encodeGeohash(-89.99, -179.99, 5)).length >= 6);

console.log("geoCell tests passed");
