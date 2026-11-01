import assert from "node:assert/strict";
import { computeStarAggregate, latestPerActor, tagOfferedFor, type AggregateTagDef, type StarReactionRow } from "./starAggregate";

const now = new Date("2026-11-01T12:00:00Z");
const day = (n: number) => new Date(now.getTime() - n * 86_400_000);
let seq = 0;
const row = (actor: string, value: number, extra: Partial<StarReactionRow> = {}): StarReactionRow => ({
  id: `r${String(++seq).padStart(3, "0")}`,
  actorKey: actor,
  targetId: "t1",
  value,
  tagIds: [],
  visitStatus: "NONE",
  ratedAt: day(1),
  ...extra,
});

// Latest rating per author per target wins.
const a1 = row("user:a", 2, { ratedAt: day(10) });
const a2 = row("user:a", 5, { ratedAt: day(2) });
const aOther = row("user:a", 3, { targetId: "t2" });
const latest = latestPerActor([a1, a2, aOther]);
assert.equal(latest.length, 2);
assert.ok(latest.includes(a2) && latest.includes(aOther));

// Empty target: neutral prior, no average.
const empty = computeStarAggregate({ rows: [], targetType: "PLACE", categoryPrior: 4.2, tags: [], now });
assert.equal(empty.ratingCount, 0);
assert.equal(empty.ratingAverage, null);
assert.equal(empty.rankScore, 4.2);

// ТЗ example: 15×5, 4×4, 1×3 → 4.7; counts consistent with the SQL CHECK.
const rows = [
  ...Array.from({ length: 15 }, (_, i) => row(`user:f${i}`, 5)),
  ...Array.from({ length: 4 }, (_, i) => row(`user:g${i}`, 4)),
  row("user:h", 3, { visitStatus: "VERIFIED" }),
];
const agg = computeStarAggregate({ rows, targetType: "EVENT", categoryPrior: 4, tags: [], now });
assert.equal(agg.ratingCount, 20);
assert.equal(agg.ratingSum, 15 * 5 + 4 * 4 + 3);
assert.equal(agg.c1 + agg.c2 + agg.c3 + agg.c4 + agg.c5, agg.ratingCount);
assert.equal(agg.c1 + 2 * agg.c2 + 3 * agg.c3 + 4 * agg.c4 + 5 * agg.c5, agg.ratingSum);
assert.equal(Math.round(agg.ratingAverage! * 10) / 10, 4.7);
assert.equal(agg.verifiedCount, 1);
assert.ok(agg.rankScore > 4 && agg.rankScore < agg.ratingAverage!, "Bayesian pull toward the prior");

// Invalid stored values (legacy scale) are ignored, never counted.
const mixed = computeStarAggregate({ rows: [row("user:x", 0), row("user:y", 5)], targetType: "PLACE", categoryPrior: 4, tags: [], now });
assert.equal(mixed.ratingCount, 1);

// Chips: eligible = reactions the chip was offered to; party category aware.
const tags: AggregateTagDef[] = [
  { id: "tg1", key: "kids-delighted", showFor: [3, 4, 5], targetTypes: ["EVENT", "OFFER"], partyCategories: [] },
  { id: "tg2", key: "boring", showFor: [1, 2, 3], targetTypes: ["EVENT", "OFFER"], partyCategories: [] },
  { id: "tg3", key: "punctual", showFor: [4, 5], targetTypes: ["OFFER"], partyCategories: ["ANIMATOR"] },
];
const chipRows = [
  row("user:c1", 5, { tagIds: ["tg1"] }),
  row("user:c2", 4, { tagIds: ["tg1", "tg3"] }),
  row("user:c3", 3, { tagIds: ["tg2"] }),
  row("user:c4", 1, { tagIds: ["tg2"] }),
];
const chips = computeStarAggregate({ rows: chipRows, targetType: "OFFER", partyCategory: "ANIMATOR", categoryPrior: 4, tags, now });
assert.deepEqual(chips.tagStats["kids-delighted"], { selected: 2, eligible: 3 });
assert.deepEqual(chips.tagStats["boring"], { selected: 2, eligible: 2 });
assert.deepEqual(chips.tagStats["punctual"], { selected: 1, eligible: 2 });
const notParty = computeStarAggregate({ rows: chipRows, targetType: "OFFER", partyCategory: "CAKE", categoryPrior: 4, tags, now });
assert.equal(notParty.tagStats["punctual"], undefined);
assert.equal(tagOfferedFor(tags[0], { targetType: "PLACE", value: 5 }), false);

// Old ratings weigh half, verified 1.5× (rankScore only, not the public average).
const fresh = computeStarAggregate({ rows: [row("user:o", 5)], targetType: "PLACE", categoryPrior: 4, tags: [], now });
const old = computeStarAggregate({ rows: [row("user:o", 5, { ratedAt: day(400) })], targetType: "PLACE", categoryPrior: 4, tags: [], now });
const verified = computeStarAggregate({ rows: [row("user:o", 5, { visitStatus: "VERIFIED" })], targetType: "PLACE", categoryPrior: 4, tags: [], now });
assert.ok(old.rankScore < fresh.rankScore && fresh.rankScore < verified.rankScore);
assert.equal(old.ratingAverage, 5);

console.log("✅ feedback star aggregate test");
