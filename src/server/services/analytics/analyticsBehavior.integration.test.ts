/**
 * Behavior buckets by Minsk wall time (ТЗ «Аналитика админки», B2) and internal-traffic exclusion (B1).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/services/analytics/analyticsBehavior.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { getAnalyticsBehavior } from "./analyticsBehavior.service";
import { resolveAnalyticsDateRange } from "./analyticsDateRange";
import type { AnalyticsOverviewFilters } from "@/lib/analytics/adminOverviewTypes";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must point at an isolated test database");

const marker = randomUUID().slice(0, 8);
const filters: AnalyticsOverviewFilters = { dateRange: "7d", entity: "all", vertical: "all", city: "", segment: "", childAgeBand: "" };

async function main() {
  const userIds: string[] = [];
  try {
    const admin = await prisma.user.create({ data: { email: `bh-${marker}@example.invalid`, role: "ADMIN" } });
    userIds.push(admin.id);
    const { start } = resolveAnalyticsDateRange("7d");
    // 01:30 Minsk on the first day of the window = 22:30 UTC the previous calendar day.
    const at = new Date(start.getTime() + 90 * 60_000);
    const minskDow = (() => {
      const wd = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Minsk", weekday: "short" }).format(at);
      return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(wd) + 1;
    })();

    const before = await getAnalyticsBehavior(filters);
    await prisma.userEvent.create({ data: { eventType: "SAVE", createdAt: at, sessionId: `bh-${marker}-u` } });
    await prisma.userEvent.create({ data: { eventType: "SAVE", createdAt: at, sessionId: `bh-${marker}-a`, userId: admin.id } });
    const after = await getAnalyticsBehavior(filters);

    const delta = (k: string) =>
      after.activityByTime.find((b) => b.key === k)!.events - before.activityByTime.find((b) => b.key === k)!.events;
    assert.equal(delta("night"), 1, "01:30 Minsk is night; admin row excluded");
    assert.equal(delta("evening"), 0, "not the UTC 22:30 evening bucket");
    const dayDelta = (dow: number) =>
      after.activityByDay.find((d) => d.isoDow === dow)!.events - before.activityByDay.find((d) => d.isoDow === dow)!.events;
    assert.equal(dayDelta(minskDow), 1, "weekday is the Minsk calendar day");
    assert.ok(!after.timezoneNote.includes("UTC"));
    console.log("analyticsBehavior.integration.test.ts: OK");
  } finally {
    await prisma.userEvent.deleteMany({ where: { OR: [{ sessionId: { startsWith: `bh-${marker}-` } }, { userId: { in: userIds } }] } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
