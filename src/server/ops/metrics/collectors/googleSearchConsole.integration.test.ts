import assert from "node:assert/strict";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { querySearchAnalytics, type GscConfig } from "./googleSearchConsole";

// Explicit opt-in only; never use the application's DATABASE_URL.
const url = process.env.GSC_TEST_DATABASE_URL;
if (!url) throw new Error("GSC_TEST_DATABASE_URL must identify a disposable local test database");
const parsed = new URL(url);
if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || !parsed.pathname.endsWith("/gsc_migration_test")) {
  throw new Error("Only the disposable local gsc_migration_test database is allowed");
}

test("migration-backed GSC cache: upsert, restart, property isolation, failed refresh", async () => {
  const prisma = new PrismaClient({ datasourceUrl: url });
  const fetchBefore = globalThis.fetch;
  const properties = ["sc-domain:gsc-integration.invalid", "sc-domain:gsc-other.invalid"];
  const config: GscConfig = { siteUrl: properties[0], clientEmail: "unused", privateKey: "unused", cache: prisma.gscQueryCache };
  const range = { startDate: "2026-10-01", endDate: "2026-10-01" };
  const row = { clicks: 2, impressions: 10, ctr: 0.2, position: 3 };
  try {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ rows: [row] }); };
    await querySearchAnalytics(config, "fake-test-token", range);
    await querySearchAnalytics(config, "fake-test-token", range);
    assert.equal(calls, 1);
    await prisma.$disconnect();
    const afterRestart = await querySearchAnalytics(config, "fake-test-token", range);
    assert.deepEqual(afterRestart, [row]); assert.equal(calls, 1);
    await querySearchAnalytics({ ...config, siteUrl: properties[1] }, "fake-test-token", range);
    assert.equal(calls, 2);
    assert.equal(await prisma.gscQueryCache.count({ where: { property: { in: properties } } }), 2);
    await prisma.gscQueryCache.updateMany({ where: { property: properties[0] }, data: { expiresAt: new Date(0) } });
    globalThis.fetch = async () => new Response("private body", { status: 403 });
    await assert.rejects(querySearchAnalytics(config, "fake-test-token", range), /HTTP 403/);
    assert.equal((await prisma.gscQueryCache.findFirstOrThrow({ where: { property: properties[0] } })).expiresAt.getTime(), 0);
    globalThis.fetch = async () => Response.json({ rows: [{ ...row, clicks: 3, ctr: 0.3 }] });
    await querySearchAnalytics(config, "fake-test-token", range);
    assert.equal(await prisma.gscQueryCache.count({ where: { property: properties[0] } }), 1);
  } finally {
    globalThis.fetch = fetchBefore;
    await prisma.gscQueryCache.deleteMany({ where: { property: { in: properties } } });
    await prisma.$disconnect();
  }
});
