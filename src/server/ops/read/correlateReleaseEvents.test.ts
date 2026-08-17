/**
 * correlateSignalReleases()/findNearestRelease() tests.
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/read/correlateReleaseEvents.test.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { correlateSignalReleases, findNearestRelease } from "./correlateReleaseEvents";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

async function main() {
  // Pure matching: nearest within window wins; outside window -> null.
  {
    const openedAt = new Date("2026-06-15T12:00:00.000Z");
    const candidates = [
      { buildId: "dev-100", gitSha: null, detectedAt: new Date("2026-06-15T11:00:00.000Z") }, // 60min away
      { buildId: "dev-101", gitSha: null, detectedAt: new Date("2026-06-15T11:50:00.000Z") }, // 10min away
      { buildId: "dev-102", gitSha: null, detectedAt: new Date("2026-06-15T12:25:00.000Z") }, // 25min away
    ];
    const nearest = findNearestRelease(candidates, openedAt);
    assert.equal(nearest?.buildId, "dev-101", "must pick the closest candidate within the window");
  }
  {
    const openedAt = new Date("2026-06-15T12:00:00.000Z");
    const candidates = [{ buildId: "dev-200", gitSha: null, detectedAt: new Date("2026-06-15T12:31:00.000Z") }]; // 31min, just outside
    assert.equal(findNearestRelease(candidates, openedAt), null, "outside the ±30min window must yield no match");
  }
  {
    const openedAt = new Date("2026-06-15T12:00:00.000Z");
    const candidates = [{ buildId: "dev-201", gitSha: null, detectedAt: new Date("2026-06-15T12:30:00.000Z") }]; // exactly 30min
    assert.equal(findNearestRelease(candidates, openedAt)?.buildId, "dev-201", "exactly at the 30min boundary must match");
  }

  // DB-backed: one bounded query correlates multiple signals at once.
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  const createdReleaseIds: string[] = [];
  try {
    const t0 = new Date("2026-06-15T09:00:00.000Z");

    const rel1 = await prisma.releaseEvent.create({
      data: { kind: "BUILD_CHANGED", buildId: "dev-900", gitSha: "aaa", processStartedAt: t0, detectedAt: t0 },
    });
    createdReleaseIds.push(rel1.id);

    const t1 = new Date("2026-06-15T15:00:00.000Z");
    const rel2 = await prisma.releaseEvent.create({
      data: { kind: "BUILD_CHANGED", buildId: "dev-901", gitSha: "bbb", processStartedAt: t1, detectedAt: t1 },
    });
    createdReleaseIds.push(rel2.id);

    const signals = [
      { id: "sig-near-rel1", openedAt: new Date("2026-06-15T09:10:00.000Z") }, // 10min after rel1
      { id: "sig-near-rel2", openedAt: new Date("2026-06-15T14:45:00.000Z") }, // 15min before rel2
      { id: "sig-no-match", openedAt: new Date("2026-06-15T12:00:00.000Z") }, // far from both
      { id: "sig-no-openedAt", openedAt: null },
    ];

    const result = await correlateSignalReleases(prisma, signals);
    assert.equal(result["sig-near-rel1"]?.buildId, "dev-900");
    assert.equal(result["sig-near-rel2"]?.buildId, "dev-901");
    assert.equal(result["sig-no-match"], null);
    assert.equal(result["sig-no-openedAt"], null);

    // Empty input never queries and returns {}.
    const empty = await correlateSignalReleases(prisma, []);
    assert.deepEqual(empty, {});

    console.log("correlateReleaseEvents.test.ts: OK");
  } finally {
    await prisma.releaseEvent.deleteMany({ where: { id: { in: createdReleaseIds } } });
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
