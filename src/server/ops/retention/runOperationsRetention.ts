/**
 * Operations Center retention (§21 Step 6, Phases H–J). Frozen cutoffs:
 *
 *   MetricSample:                          90 days (collectedAt)
 *   DetectorRun:                           30 days (finishedAt)
 *   OperationalSignal status=RESOLVED:    180 days (resolvedAt)
 *   OperationalSignal status=ABORTED:      14 days (resolvedAt)
 *
 * OperationsSnapshot, ReleaseEvent, OperationsViewState, AuditLog,
 * AdminAuditLog are never touched here — no retention is defined for them
 * in the frozen contract.
 *
 * All cutoffs are computed from ONE DB-observed instant
 * (`SELECT clock_timestamp()`), not worker wall-clock, so a single run is
 * internally consistent. Boundary is strict: an entity exactly at the
 * retention age is KEPT (`< cutoff`, not `<= cutoff`).
 *
 * Deletes are independent per table (no cross-table transaction) —
 * restart-safe and idempotent by construction: a partial failure simply
 * leaves the remaining tables for the next scheduled run.
 */
import type { PrismaClient } from "@prisma/client";
import { getDbNow } from "../dbTime";

export const METRIC_SAMPLE_RETENTION_DAYS = 90;
export const DETECTOR_RUN_RETENTION_DAYS = 30;
export const RESOLVED_SIGNAL_RETENTION_DAYS = 180;
export const ABORTED_SIGNAL_RETENTION_DAYS = 14;

export interface OperationsRetentionCutoffs {
  metricSample: Date;
  detectorRun: Date;
  resolvedSignal: Date;
  abortedSignal: Date;
}

export interface OperationsRetentionResult {
  startedAt: Date;
  cutoffs: OperationsRetentionCutoffs;
  deleted: {
    metricSamples: number;
    detectorRuns: number;
    resolvedSignals: number;
    abortedSignals: number;
  };
}

function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function computeOperationsRetentionCutoffs(now: Date): OperationsRetentionCutoffs {
  return {
    metricSample: daysBefore(now, METRIC_SAMPLE_RETENTION_DAYS),
    detectorRun: daysBefore(now, DETECTOR_RUN_RETENTION_DAYS),
    resolvedSignal: daysBefore(now, RESOLVED_SIGNAL_RETENTION_DAYS),
    abortedSignal: daysBefore(now, ABORTED_SIGNAL_RETENTION_DAYS),
  };
}

/**
 * Testable core: accepts an already-obtained DB-now instant instead of
 * calling `getDbNow` itself, so tests can supply an exact controlled
 * reference time and place fixtures at bit-exact cutoffs. Production code
 * should call `runOperationsRetention(prisma)` below, which is the only
 * caller that actually queries `clock_timestamp()`.
 */
export async function runOperationsRetentionAt(
  prisma: PrismaClient,
  startedAt: Date,
): Promise<OperationsRetentionResult> {
  const cutoffs = computeOperationsRetentionCutoffs(startedAt);

  const metricSamples = await prisma.metricSample.deleteMany({
    where: { collectedAt: { lt: cutoffs.metricSample } },
  });

  // finishedAt IS NULL (still-RUNNING) rows never match `lt` under SQL NULL
  // semantics — a genuinely active or crashed-orphan run is never deleted.
  // No speculative "stuck run repair" is implemented for orphan RUNNING
  // rows in v1; every code path that creates a DetectorRun sets
  // finishedAt in the same synchronous execution before returning (see
  // detectorRun.ts), so a lingering RUNNING row only exists for the
  // duration of an in-flight execution.
  const detectorRuns = await prisma.detectorRun.deleteMany({
    where: { finishedAt: { lt: cutoffs.detectorRun } },
  });

  const resolvedSignals = await prisma.operationalSignal.deleteMany({
    where: { status: "RESOLVED", resolvedAt: { lt: cutoffs.resolvedSignal } },
  });

  const abortedSignals = await prisma.operationalSignal.deleteMany({
    where: { status: "ABORTED", resolvedAt: { lt: cutoffs.abortedSignal } },
  });

  return {
    startedAt,
    cutoffs,
    deleted: {
      metricSamples: metricSamples.count,
      detectorRuns: detectorRuns.count,
      resolvedSignals: resolvedSignals.count,
      abortedSignals: abortedSignals.count,
    },
  };
}

export async function runOperationsRetention(prisma: PrismaClient): Promise<OperationsRetentionResult> {
  const startedAt = await getDbNow(prisma);
  return runOperationsRetentionAt(prisma, startedAt);
}
