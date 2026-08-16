/**
 * Operations Center v1 — detector contract (§21 Step 2).
 * Spec: "mamaGo Operations Center v1 — Specification", rev 1.2.1.
 *
 * Types only. No detector implementations exist yet — those start in
 * Steps 3–4.
 */
import type { PrismaClient } from "@prisma/client";

/** Frozen v1 node keys. See nodeRegistry.ts for the canonical list. */
export type NodeKey = "PROD" | "DB" | "Operations" | "Indexability";

/**
 * GREEN = PROVEN OK. A node can only report OK once a covering detector has
 * actually run successfully — never assumed, never defaulted to green.
 * NO_DATA means "no covering detector has successfully run yet", which is
 * the truthful state for every node while DetectorRegistry is empty.
 */
export type NodeState = "OK" | "WARNING" | "CRITICAL" | "NO_DATA";

export interface DetectorContext {
  prisma: PrismaClient;
  fetch: typeof globalThis.fetch;
}

export interface SampleDraft {
  metric: string;
  dimKey?: string;
  value: number;
}

export interface SignalDraft {
  fingerprint: string;
  type: string;
  severity: "CRITICAL" | "WARNING";
  title: string;
  summary?: string;
  detailsUrl?: string;
  entityType?: string;
  entityId?: string;
  payload?: unknown;
}

export interface DetectorResult {
  samples: SampleDraft[];
  signals: SignalDraft[];
}

export interface DetectorHysteresis {
  /** Consecutive hits required before a signal opens. */
  open: number;
  /** Consecutive misses required before an open signal closes. close > open. */
  close: number;
}

export interface Detector<TProbe> {
  name: string;
  intervalSec: number;
  timeoutMs: number;
  nodes: NodeKey[];
  /** Default contract: open = 2, close = 3 (close > open). */
  hysteresis?: DetectorHysteresis;

  probe(ctx: DetectorContext): Promise<TProbe>;
  evaluate(probe: TProbe): DetectorResult;
}

export const DEFAULT_HYSTERESIS: DetectorHysteresis = { open: 2, close: 3 };
