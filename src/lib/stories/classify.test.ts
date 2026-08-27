import assert from "node:assert/strict";
import { classifyFreeItems, classifyRunningItems, type StoryRailCandidatePool } from "./classify";
import type { DateRange } from "./types";

const range: DateRange = {
  start: new Date("2026-08-27T00:00:00.000Z"),
  end: new Date("2026-09-03T00:00:00.000Z"),
};

const pool: StoryRailCandidatePool = {
  activitySessions: [
    {
      id: "serial-late",
      startsAt: new Date("2026-08-30T12:00:00.000Z"),
      activityId: "serial-free",
      title: "Serial free",
      placeId: null,
      coverMediaAssetId: null,
      parentClass: "serial",
      isFree: true,
    },
    {
      id: "serial-earliest",
      startsAt: new Date("2026-08-27T15:00:00.000Z"),
      activityId: "serial-free",
      title: "Serial free",
      placeId: null,
      coverMediaAssetId: null,
      parentClass: "serial",
      isFree: true,
    },
    {
      id: "point-free",
      startsAt: new Date("2026-08-28T10:00:00.000Z"),
      activityId: "point-free",
      title: "Point free",
      placeId: null,
      coverMediaAssetId: null,
      parentClass: "point",
      isFree: true,
    },
  ],
  activityOrphans: [],
  offerSessions: [],
  ongoingOffers: [],
};

{
  const running = classifyRunningItems(pool, range);
  assert.equal(running.length, 1);
  assert.equal(running[0]?.entityId, "serial-free");
  assert.equal(
    running[0]?.at.toISOString(),
    "2026-08-27T15:00:00.000Z",
    "serial representative must be earliest matching occurrence, not DB row order",
  );
  console.log("serial representative is deterministic: OK");
}

{
  const free = classifyFreeItems(pool, range, "always");
  assert.equal(free.filter((entry) => entry.timeClass === "serial").length, 1);
  assert.equal(free.filter((entry) => entry.timeClass === "point").length, 1);
  assert.ok(free.some((entry) => entry.entityId === "serial-free"));
  assert.ok(free.some((entry) => entry.entityId === "point-free"));
  console.log("free facet includes point and serial free activities: OK");
}

console.log("classify stories tests: all OK");
