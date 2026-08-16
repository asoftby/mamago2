/**
 * db_degraded detector tests (§21 Step 3, Phase E).
 * Pure evaluate() tests + a real probe() against the isolated PostgreSQL DB.
 *
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/detectors/dbDegraded.test.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import { evaluateDbDegraded, probeDbDegraded, type DbDegradedProbe } from "./dbDegraded";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

function probe(latencyMs: number, capacityPct: number): DbDegradedProbe {
  return { latencyMs, connectionCount: Math.round(capacityPct), maxConnections: 100, connectionCapacityPct: capacityPct };
}

// ── Pure evaluate() tests ──────────────────────────────────────────────

// 100ms, 20% -> no signal.
{
  const result = evaluateDbDegraded(probe(100, 20));
  assert.deepEqual(result.signals, []);
  assert.equal(result.samples.length, 2);
}

// 501ms, 20% -> latency WARNING only.
{
  const result = evaluateDbDegraded(probe(501, 20));
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0].fingerprint, "db.degraded:latency");
  assert.equal(result.signals[0].severity, "WARNING");
}

// 100ms, 81% -> capacity WARNING only.
{
  const result = evaluateDbDegraded(probe(100, 81));
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0].fingerprint, "db.degraded:capacity");
}

// 700ms, 90% -> both signals, never merged.
{
  const result = evaluateDbDegraded(probe(700, 90));
  assert.equal(result.signals.length, 2);
  const fingerprints = result.signals.map((s) => s.fingerprint).sort();
  assert.deepEqual(fingerprints, ["db.degraded:capacity", "db.degraded:latency"]);
}

// Boundary: exactly 500ms -> NOT a warning (strictly greater than).
{
  const result = evaluateDbDegraded(probe(500, 20));
  assert.deepEqual(result.signals, []);
}

// Boundary: exactly 80% -> NOT a warning (strictly greater than).
{
  const result = evaluateDbDegraded(probe(100, 80));
  assert.deepEqual(result.signals, []);
}

// Samples always carry the frozen metric names.
{
  const result = evaluateDbDegraded(probe(100, 20));
  const metrics = result.samples.map((s) => s.metric).sort();
  assert.deepEqual(metrics, ["db.connection_capacity_pct", "db.latency_ms"]);
}

console.log("dbDegraded.test.ts (pure): OK");

// ── Integration: real probe() against isolated PostgreSQL ──────────────

async function testProbeIntegration() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  try {
    const result = await probeDbDegraded(prisma);
    assert.ok(result.latencyMs >= 0, "latency must be non-negative");
    assert.ok(result.latencyMs < 5_000, "latency against a local isolated DB must be well under 5s");
    assert.ok(result.connectionCount >= 1, "at least this connection must be counted");
    assert.ok(result.maxConnections > 0, "max_connections must be a plausible positive number");
    assert.ok(
      result.connectionCapacityPct >= 0 && result.connectionCapacityPct <= 100,
      "capacity pct must be a plausible percentage",
    );

    const [clientBackends] = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count
      FROM pg_stat_activity
      WHERE backend_type = 'client backend'
    `;
    const [allBackends] = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count FROM pg_stat_activity
    `;
    assert.equal(
      result.connectionCount,
      Number(clientBackends.count),
      "numerator must equal client-backend count only",
    );
    assert.ok(
      Number(allBackends.count) >= result.connectionCount,
      "unfiltered pg_stat_activity must be >= client-backend numerator",
    );
    assert.equal(
      result.connectionCapacityPct,
      (result.connectionCount / result.maxConnections) * 100,
      "capacity pct must use max_connections as denominator",
    );
    console.log("dbDegraded.test.ts (integration probe): OK", result);
  } finally {
    await prisma.$disconnect();
  }
}

testProbeIntegration().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
