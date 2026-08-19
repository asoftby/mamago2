/**
 * search collector tests (§21 Step 5, Phase P).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/metrics/collectors/search.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { collectSearchMetrics } from "./search";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const marker = randomUUID().slice(0, 8);
const createdLogIds: string[] = [];

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  async function makeLog(resultsCount: number, createdAt: Date) {
    const log = await prisma.searchQueryLog.create({
      data: { query: `q-${marker}-${randomUUID()}`, resultsCount, createdAt },
    });
    createdLogIds.push(log.id);
  }

  try {
    const now = new Date("2026-08-17T12:00:00.000Z");
    const inWindow = new Date(now.getTime() - 5 * 60 * 1000); // 5 min ago
    const outsideWindow = new Date(now.getTime() - 20 * 60 * 1000); // 20 min ago, outside 15min window
    const rightAtBoundary = new Date(now.getTime() - 15 * 60 * 1000); // exactly at window start (inclusive)

    // Non-zero rate: 2 total, 1 zero-result.
    await makeLog(5, inWindow);
    await makeLog(0, inWindow);
    await makeLog(3, outsideWindow); // must be excluded
    await makeLog(1, rightAtBoundary); // inclusive boundary

    const result = await collectSearchMetrics({ prisma, now });
    const total = result.find((s) => s.metric === "search.queries_total");
    const rate = result.find((s) => s.metric === "search.zero_result_rate");
    assert.equal(total?.value, 3, "must count only queries within the 15-min window (2 inWindow + 1 boundary)");
    assert.equal(rate?.value, 1 / 3, "zero-result rate = zero-result queries / total queries");

    await prisma.searchQueryLog.deleteMany({ where: { id: { in: createdLogIds } } });
    createdLogIds.length = 0;

    // Zero denominator: no queries at all in window -> zero_result_rate skipped.
    {
      const result2 = await collectSearchMetrics({ prisma, now });
      const total2 = result2.find((s) => s.metric === "search.queries_total");
      const rate2 = result2.find((s) => s.metric === "search.zero_result_rate");
      assert.equal(total2?.value, 0, "search.queries_total = 0 is a valid factual observation");
      assert.equal(rate2, undefined, "zero_result_rate must be skipped, never a fake 0, when denominator is 0");
    }

    // Non-zero denominator, zero numerator -> rate is exactly 0 (real, not skipped).
    {
      await makeLog(10, inWindow);
      const result3 = await collectSearchMetrics({ prisma, now });
      const rate3 = result3.find((s) => s.metric === "search.zero_result_rate");
      assert.equal(rate3?.value, 0, "a real zero rate (no zero-result queries) must still be written");
    }

    console.log("search.test.ts: OK");
  } finally {
    await prisma.searchQueryLog.deleteMany({ where: { id: { in: createdLogIds } } });
    await prisma.$disconnect();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
