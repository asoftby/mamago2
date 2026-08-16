/**
 * Pure tests for the shared detector-freshness helper.
 * Run: npx tsx src/server/ops/detectorFreshness.test.ts
 */
import assert from "node:assert/strict";

import { computeDetectorFreshness } from "./detectorFreshness";

const intervalSec = 60;
const workerStartedAt = new Date("2026-08-16T12:00:00.000Z");

// Never ran, still within cold-start grace (< 3x60s = 180s after start).
{
  const r = computeDetectorFreshness({
    intervalSec,
    lastOkAt: null,
    now: new Date("2026-08-16T12:02:00.000Z"), // +120s
    workerStartedAt,
  });
  assert.equal(r.isStale, true);
  assert.equal(r.inColdStartGrace, true);
}

// Never ran, grace expired (> 180s after start).
{
  const r = computeDetectorFreshness({
    intervalSec,
    lastOkAt: null,
    now: new Date("2026-08-16T12:03:01.000Z"), // +181s
    workerStartedAt,
  });
  assert.equal(r.isStale, true);
  assert.equal(r.inColdStartGrace, false);
}

// Ran OK recently -> fresh.
{
  const r = computeDetectorFreshness({
    intervalSec,
    lastOkAt: new Date("2026-08-16T12:10:00.000Z"),
    now: new Date("2026-08-16T12:10:30.000Z"), // +30s
    workerStartedAt,
  });
  assert.equal(r.isStale, false);
  assert.equal(r.inColdStartGrace, false);
}

// Ran OK, but last success is older than 3x interval -> stale, no grace.
{
  const r = computeDetectorFreshness({
    intervalSec,
    lastOkAt: new Date("2026-08-16T12:10:00.000Z"),
    now: new Date("2026-08-16T12:13:01.000Z"), // +181s
    workerStartedAt,
  });
  assert.equal(r.isStale, true);
  assert.equal(r.inColdStartGrace, false);
}

// Exactly at the 3x interval boundary -> NOT stale yet (strictly greater than).
{
  const r = computeDetectorFreshness({
    intervalSec,
    lastOkAt: new Date("2026-08-16T12:10:00.000Z"),
    now: new Date("2026-08-16T12:13:00.000Z"), // exactly +180s
    workerStartedAt,
  });
  assert.equal(r.isStale, false);
}

console.log("detectorFreshness.test.ts: OK");
