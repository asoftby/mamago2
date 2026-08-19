import assert from "node:assert/strict";
import { countValidRoutePoints, hasEnoughValidRoutePoints } from "./validRoutePoints";

function testZeroValidPointsMapDoesNotRender() {
  assert.equal(hasEnoughValidRoutePoints([{ lat: null, lng: null }, { lat: null, lng: null }]), false);
}

function testOneValidPointMapDoesNotRender() {
  assert.equal(hasEnoughValidRoutePoints([{ lat: 53.9, lng: 27.5667 }, { lat: null, lng: null }]), false);
}

function testTwoValidDistinctPointsMapRenders() {
  assert.equal(
    hasEnoughValidRoutePoints([
      { lat: 53.9, lng: 27.5667 },
      { lat: 53.91, lng: 27.57 },
    ]),
    true,
  );
  assert.equal(countValidRoutePoints([{ lat: 53.9, lng: 27.5667 }, { lat: 53.91, lng: 27.57 }]), 2);
}

function testInvalidRangesAreExcluded() {
  const stops = [
    { lat: 999, lng: 27.5 }, // out of latitude range
    { lat: 53.9, lng: -999 }, // out of longitude range
    { lat: NaN, lng: 27.5 },
    { lat: 53.9, lng: NaN },
    { lat: undefined, lng: 27.5 },
    { lat: 53.9, lng: undefined },
    { lat: null, lng: null },
  ];
  assert.equal(countValidRoutePoints(stops), 0);
  assert.equal(hasEnoughValidRoutePoints(stops), false);
}

function testDuplicateCoordinatesDoNotCreateAFalseRoute() {
  const stops = [
    { lat: 53.9, lng: 27.5667 },
    { lat: 53.9, lng: 27.5667 },
    { lat: 53.9, lng: 27.5667 },
  ];
  assert.equal(countValidRoutePoints(stops), 1, "three identical points must count as one distinct point");
  assert.equal(hasEnoughValidRoutePoints(stops), false);
}

function testTechnicalDefaultZeroZeroExcluded() {
  const stops = [
    { lat: 0, lng: 0 },
    { lat: 53.9, lng: 27.5667 },
  ];
  assert.equal(countValidRoutePoints(stops), 1, "(0,0) is a technical default, never a real point");
  assert.equal(hasEnoughValidRoutePoints(stops), false);
}

function testAllCurrentRouteStopsHaveZeroValidPoints() {
  // Mirrors the actual current DB state: 0/90 RouteStops have lat/lng.
  const stops = Array.from({ length: 6 }, () => ({ lat: null, lng: null }));
  assert.equal(countValidRoutePoints(stops), 0);
  assert.equal(hasEnoughValidRoutePoints(stops), false);
}

testZeroValidPointsMapDoesNotRender();
testOneValidPointMapDoesNotRender();
testTwoValidDistinctPointsMapRenders();
testInvalidRangesAreExcluded();
testDuplicateCoordinatesDoNotCreateAFalseRoute();
testTechnicalDefaultZeroZeroExcluded();
testAllCurrentRouteStopsHaveZeroValidPoints();

console.log("validRoutePoints tests: OK");
