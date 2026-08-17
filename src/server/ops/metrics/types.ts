/**
 * MetricSample collector contract (§21 Step 5, Phase B).
 *
 * Deliberately NOT a Detector: collectors never register in
 * DetectorRegistry, never create a DetectorRun, never open/reconcile an
 * OperationalSignal, and never influence a node's color. They exist only
 * to accumulate MetricSample history and feed current values into
 * OperationsSnapshot.
 */
import type { PrismaClient } from "@prisma/client";

export interface MetricSampleDraft {
  metric: string;
  dimKey?: string;
  value: number;
}

export interface MetricCollectorContext {
  prisma: PrismaClient;
  /**
   * DB-derived instant captured once at the start of this collection
   * cycle (`SELECT clock_timestamp()`) — the authoritative "now" for any
   * time-window query the collector needs, and the exact value that will
   * be used as `collectedAt` for every sample this call returns.
   */
  now: Date;
}

export interface MetricCollector {
  name: string;
  intervalSec: number;
  timeoutMs: number;
  /**
   * Must gather ALL required source values successfully before returning
   * — either the complete batch for this cycle, or throw. Never return a
   * partial batch. An empty array is a legitimate "nothing to write this
   * cycle" result (e.g. a ratio skipped because its denominator is zero),
   * not a failure.
   */
  collect(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]>;
}
