/**
 * Detector #2: db_degraded (§21 Step 3, Phase E).
 *
 * Two independent fingerprints — latency and connection capacity — both
 * may fire simultaneously; never merged into one generic DB signal.
 *
 * db.connection_capacity_pct =
 *   current client connections / max_connections * 100
 *
 * Numerator counts only `backend_type = 'client backend'` rows in
 * pg_stat_activity. Internal PostgreSQL server processes also appear in
 * that view and must not inflate capacity usage. Do NOT filter
 * `state = 'active'` — idle client sessions still occupy a connection
 * slot toward max_connections. Denominator remains max_connections.
 */
import type { PrismaClient } from "@prisma/client";

import type { Detector, DetectorContext, DetectorResult, SampleDraft, SignalDraft } from "../types";

export const DB_LATENCY_THRESHOLD_MS = 500;
export const DB_CAPACITY_THRESHOLD_PCT = 80;

export const DB_LATENCY_FINGERPRINT = "db.degraded:latency";
export const DB_CAPACITY_FINGERPRINT = "db.degraded:capacity";

export interface DbDegradedProbe {
  latencyMs: number;
  connectionCount: number;
  maxConnections: number;
  connectionCapacityPct: number;
}

export async function probeDbDegraded(prisma: PrismaClient): Promise<DbDegradedProbe> {
  const startedAt = performance.now();
  await prisma.$queryRaw`SELECT 1`;
  const latencyMs = performance.now() - startedAt;

  const [connRow] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint AS count
    FROM pg_stat_activity
    WHERE backend_type = 'client backend'
  `;
  const [maxRow] = await prisma.$queryRaw<{ max_connections: number }[]>`
    SELECT current_setting('max_connections')::int AS max_connections
  `;

  const connectionCount = Number(connRow.count);
  const maxConnections = maxRow.max_connections;
  const connectionCapacityPct = (connectionCount / maxConnections) * 100;

  return { latencyMs, connectionCount, maxConnections, connectionCapacityPct };
}

export function evaluateDbDegraded(probe: DbDegradedProbe): DetectorResult {
  const samples: SampleDraft[] = [
    { metric: "db.latency_ms", value: probe.latencyMs },
    { metric: "db.connection_capacity_pct", value: probe.connectionCapacityPct },
  ];
  const signals: SignalDraft[] = [];

  if (probe.latencyMs > DB_LATENCY_THRESHOLD_MS) {
    signals.push({
      fingerprint: DB_LATENCY_FINGERPRINT,
      type: "DB_DEGRADED_LATENCY",
      severity: "WARNING",
      title: "Database latency elevated",
      summary: `SELECT 1 took ${probe.latencyMs.toFixed(1)}ms (threshold ${DB_LATENCY_THRESHOLD_MS}ms)`,
    });
  }

  if (probe.connectionCapacityPct > DB_CAPACITY_THRESHOLD_PCT) {
    signals.push({
      fingerprint: DB_CAPACITY_FINGERPRINT,
      type: "DB_DEGRADED_CAPACITY",
      severity: "WARNING",
      title: "Database connection capacity elevated",
      summary: `${probe.connectionCount}/${probe.maxConnections} connections (${probe.connectionCapacityPct.toFixed(1)}%, threshold ${DB_CAPACITY_THRESHOLD_PCT}%)`,
    });
  }

  return { samples, signals };
}

export const dbDegradedDetector: Detector<DbDegradedProbe> = {
  name: "db_degraded",
  intervalSec: 60,
  timeoutMs: 5_000,
  nodes: ["DB"],
  probe: (ctx: DetectorContext) => probeDbDegraded(ctx.prisma),
  evaluate: evaluateDbDegraded,
};
