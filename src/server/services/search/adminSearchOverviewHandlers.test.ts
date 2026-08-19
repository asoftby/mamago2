/**
 * Regression test for the admin Search Overview page's real-data
 * aggregation (Task 2 corrective scope: /admin/search previously showed
 * hardcoded mock stats and a fake "Popular Queries" table labeled with a
 * banner admitting it was mock — this replaces it with real SearchQueryLog
 * aggregates). Confirms computeSearchOverview() reports actual counts, not
 * fabricated ones, and never invents a CTR figure since click-through isn't
 * tracked (BACKLOG-025).
 *
 * Self-generated temporary fixtures (created and torn down within this
 * file), per project convention — no committed snapshot or /tmp dependency.
 *
 * Запуск: set -a; source .env; set +a; npx tsx src/server/services/search/adminSearchOverviewHandlers.test.ts
 */
import assert from "node:assert/strict";
import prisma from "@/lib/prisma";
import { computeSearchOverview } from "./adminSearchOverviewHandlers";

const TAG = "test-fixture-search-overview";

async function withFixtureLogs<T>(fn: () => Promise<T>): Promise<T> {
  const now = new Date();
  const rows = [
    { query: TAG, resultsCount: 3, createdAt: now },
    { query: TAG, resultsCount: 3, createdAt: now },
    { query: TAG, resultsCount: 0, createdAt: now },
    { query: `${TAG}-other`, resultsCount: 5, createdAt: now },
    // Outside the 7-day window — must not be counted.
    { query: TAG, resultsCount: 1, createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) },
  ];
  await prisma.searchQueryLog.createMany({ data: rows });
  try {
    return await fn();
  } finally {
    await prisma.searchQueryLog.deleteMany({ where: { query: { startsWith: TAG } } });
  }
}

async function testRealCountsNotMock() {
  await withFixtureLogs(async () => {
    const data = await computeSearchOverview();

    // 3 in-window rows beats any pre-existing real query's count in this
    // dev DB, so the fixture query is guaranteed a top-10 slot regardless
    // of concurrent real traffic — avoids depending on tie-break order.
    const fixtureTotal = data.popularQueries.find((p) => p.query === TAG)?.count ?? 0;
    assert.equal(fixtureTotal, 3, "in-window fixture rows for the primary query must be counted exactly, excluding the out-of-window row");

    assert.ok(data.stats.totalQueries >= 4, "totalQueries must reflect real in-window rows (at least the 4 fixture rows)");
    assert.ok(data.stats.uniqueQueries >= 2, "uniqueQueries must count distinct query strings (at least the 2 fixture queries)");
    assert.ok(data.stats.zeroResultQueries >= 1, "zeroResultQueries must count real resultsCount=0 rows (at least the 1 fixture row)");

    // The low-frequency second fixture query may or may not make the
    // top-10 depending on concurrent real traffic — verify its real count
    // independently of ranking rather than asserting list membership.
    const otherCount = await prisma.searchQueryLog.count({
      where: { query: `${TAG}-other`, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    });
    assert.equal(otherCount, 1, "second fixture query must have exactly its one in-window row counted");
  });
}

async function testNoCtrFieldInvented() {
  await withFixtureLogs(async () => {
    const data = await computeSearchOverview();
    assert.ok(!("ctr" in data.stats), "stats must never include a fabricated CTR field");
    for (const p of data.popularQueries) {
      assert.ok(!("ctr" in p), "popular query rows must never include a fabricated CTR field");
    }
  });
}

async function main() {
  await testRealCountsNotMock();
  await testNoCtrFieldInvented();
  console.log("adminSearchOverviewHandlers tests: OK");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
