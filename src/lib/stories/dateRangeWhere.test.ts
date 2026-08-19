import assert from "node:assert/strict";
import { fromZonedTime } from "date-fns-tz";

import {
  buildDateRangeWhere,
  ongoingBelongsToRange,
  occurrenceBelongsToRange,
} from "./dateRangeWhere";
import { formatStoryBadgeExtra, STORY_BADGE_DISPLAY_CAP } from "./badge";
import { seededShuffle, storySlotShuffleSeed } from "./shuffle";
import { classifyItemsForRange, classifyRunningItems, type StoryRailCandidatePool } from "./classify";
import { jaccardOverlap, visualDuplicatePairRate, jaccardByItemIds, jaccardByParentEntity, entityRepeatDistribution } from "./metrics";
import type { DateRange } from "./types";

const TZ = "Europe/Minsk";

function dayRange(startKey: string, endKeyExclusive: string): DateRange {
  return {
    start: fromZonedTime(`${startKey}T00:00:00`, TZ),
    end: fromZonedTime(`${endKeyExclusive}T00:00:00`, TZ),
  };
}

// ── occurrence membership ────────────────────────────────────────────────────

{
  const range = dayRange("2026-08-01", "2026-08-02");
  assert.equal(
    occurrenceBelongsToRange(fromZonedTime("2026-08-01T10:00:00", TZ), range),
    true,
  );
  assert.equal(
    occurrenceBelongsToRange(fromZonedTime("2026-08-02T00:00:00", TZ), range),
    false,
  );
  assert.equal(
    occurrenceBelongsToRange(fromZonedTime("2026-07-31T23:59:00", TZ), range),
    false,
  );
  console.log("occurrenceBelongsToRange: OK");
}

// ── ongoing policies ─────────────────────────────────────────────────────────

{
  const range = dayRange("2026-08-01", "2026-08-03"); // Sat–Sun weekend-like
  const summer = {
    dateFrom: fromZonedTime("2026-06-01T00:00:00", TZ),
    dateTo: fromZonedTime("2026-08-31T00:00:00", TZ),
  };
  const opensInside = {
    dateFrom: fromZonedTime("2026-08-01T00:00:00", TZ),
    dateTo: fromZonedTime("2026-09-01T00:00:00", TZ),
  };
  const closesInside = {
    dateFrom: fromZonedTime("2026-07-01T00:00:00", TZ),
    dateTo: fromZonedTime("2026-08-02T12:00:00", TZ),
  };
  const outside = {
    dateFrom: fromZonedTime("2026-09-01T00:00:00", TZ),
    dateTo: fromZonedTime("2026-09-10T00:00:00", TZ),
  };

  assert.equal(ongoingBelongsToRange(summer, range, "always"), true);
  assert.equal(ongoingBelongsToRange(summer, range, "never"), false);
  assert.equal(ongoingBelongsToRange(summer, range, "boundary"), false);

  assert.equal(ongoingBelongsToRange(opensInside, range, "boundary"), true);
  assert.equal(ongoingBelongsToRange(closesInside, range, "boundary"), true);
  assert.equal(ongoingBelongsToRange(outside, range, "always"), false);
  assert.equal(ongoingBelongsToRange(outside, range, "boundary"), false);
  console.log("ongoingBelongsToRange policies: OK");
}

// ── buildDateRangeWhere modes are distinct ───────────────────────────────────

{
  const range = dayRange("2026-08-01", "2026-08-02");
  const occ = buildDateRangeWhere(range, TZ, "occurrence");
  assert.deepEqual(occ, {
    startsAt: { gte: range.start, lt: range.end },
  });

  const never = buildDateRangeWhere(range, TZ, "ongoing", { ongoingPolicy: "never" });
  assert.deepEqual(never, { id: { in: [] } });

  const boundary = buildDateRangeWhere(range, TZ, "ongoing", {
    ongoingPolicy: "boundary",
  });
  assert.ok(Array.isArray((boundary as { OR: unknown }).OR));
  console.log("buildDateRangeWhere modes: OK");
}

// ── classify: same predicates → counts match content length ──────────────────

{
  const range = dayRange("2026-08-01", "2026-08-02");
  const pool: StoryRailCandidatePool = {
    activitySessions: [
      {
        id: "as1",
        startsAt: fromZonedTime("2026-08-01T11:00:00", TZ),
        activityId: "a1",
        title: "A",
        placeId: "p1",
        coverMediaAssetId: "m1",
        parentClass: "point",
      },
      {
        id: "as2",
        startsAt: fromZonedTime("2026-08-02T11:00:00", TZ),
        activityId: "a2",
        title: "B",
        placeId: "p2",
        coverMediaAssetId: null,
        parentClass: "point",
      },
      {
        id: "as-serial",
        startsAt: fromZonedTime("2026-08-01T12:00:00", TZ),
        activityId: "a-serial",
        title: "Camp",
        placeId: "p9",
        coverMediaAssetId: "m9",
        parentClass: "serial",
      },
    ],
    activityOrphans: [],
    offerSessions: [
      {
        id: "os1",
        startAt: fromZonedTime("2026-08-01T15:00:00", TZ),
        offerId: "o1",
        title: "Camp day",
        placeId: "p1",
        coverMediaAssetId: "m1",
      },
    ],
    ongoingOffers: [
      {
        id: "o2",
        dateFrom: fromZonedTime("2026-06-01T00:00:00", TZ),
        dateTo: fromZonedTime("2026-08-31T00:00:00", TZ),
        title: "Summer pass",
        placeId: "p3",
        coverMediaAssetId: "m3",
        hasSessions: false,
      },
    ],
  };

  const always = classifyItemsForRange(pool, range, "always");
  assert.equal(always.length, 3); // as1, os1, window o2 — serial excluded
  assert.equal(always.filter((i) => i.timeClass === "point").length, 2);
  assert.equal(always.filter((i) => i.timeClass === "window").length, 1);
  assert.ok(!always.some((i) => i.entityId === "a-serial"));

  const never = classifyItemsForRange(pool, range, "never");
  assert.equal(never.length, 2);
  assert.ok(never.every((i) => i.timeClass === "point"));

  const boundary = classifyItemsForRange(pool, range, "boundary");
  assert.equal(boundary.length, 2); // summer pass does not open/close inside

  // ids
  assert.ok(always.some((i) => i.id === "activity-session:as1"));
  assert.ok(always.some((i) => i.id === "offer-session:os1"));
  assert.ok(always.some((i) => i.id === "offer:o2"));

  const running = classifyRunningItems(pool, range);
  assert.equal(running.length, 1);
  assert.equal(running[0]?.id, "activity:a-serial");
  assert.equal(running[0]?.timeClass, "serial");
  console.log("classify + id scheme + serial exclusion: OK");
}

// ── badge cap vs internal count ──────────────────────────────────────────────

{
  assert.equal(formatStoryBadgeExtra(1), null);
  assert.equal(formatStoryBadgeExtra(2), "+1");
  assert.equal(formatStoryBadgeExtra(10), "+9");
  assert.equal(formatStoryBadgeExtra(100), `+${STORY_BADGE_DISPLAY_CAP}`);
  console.log("badge cap: OK");
}

// ── seeded shuffle stable ────────────────────────────────────────────────────

{
  const items = [1, 2, 3, 4, 5, 6, 7, 8];
  const seed = storySlotShuffleSeed("today", "2026-08-01");
  const a = seededShuffle(items, seed);
  const b = seededShuffle(items, seed);
  assert.deepEqual(a, b);
  const c = seededShuffle(items, storySlotShuffleSeed("today", "2026-08-02"));
  assert.notDeepEqual(a, c);
  console.log("seededShuffle: OK");
}

// ── metrics helpers ──────────────────────────────────────────────────────────

{
  assert.equal(jaccardOverlap(["a", "b"], ["b", "c"]), 1 / 3);
  // parent entity jaccard sees shared activity across session items
  const slotA = [
    {
      id: "activity-session:1" as const,
      timeClass: "point" as const,
      entityKind: "activity" as const,
      entityId: "act1",
      sessionId: "1",
      placeId: "p",
      coverMediaAssetId: "m",
      title: "x",
      at: new Date(),
    },
  ];
  const slotB = [
    {
      id: "activity-session:2" as const,
      timeClass: "point" as const,
      entityKind: "activity" as const,
      entityId: "act1",
      sessionId: "2",
      placeId: "p",
      coverMediaAssetId: "m",
      title: "x",
      at: new Date(),
    },
  ];
  assert.equal(jaccardByItemIds(slotA, slotB), 0);
  assert.equal(jaccardByParentEntity(slotA, slotB), 1);

  const dist = entityRepeatDistribution([
    { slotId: "today", items: slotA },
    { slotId: "running", items: slotB },
  ]);
  assert.deepEqual(dist, { in1: 0, in2: 1, in3plus: 0, totalEntities: 1 });

  const rate = visualDuplicatePairRate([
    {
      id: "activity-session:1",
      timeClass: "point",
      entityKind: "activity",
      entityId: "a",
      sessionId: "1",
      placeId: "p",
      coverMediaAssetId: "m",
      title: "x",
      at: new Date(),
    },
    {
      id: "offer-session:2",
      timeClass: "point",
      entityKind: "offer",
      entityId: "o",
      sessionId: "2",
      placeId: "p",
      coverMediaAssetId: "m",
      title: "y",
      at: new Date(),
    },
  ]);
  assert.equal(rate.pairCount, 1);
  assert.equal(rate.rate, 1);
  console.log("metrics: OK");
}

console.log("\ndateRangeWhere / classify tests: all OK");
