/**
 * OperationsSnapshot payload contract (§21 Step 2 Phase L, extended by
 * Step 3 Phases H/L).
 *
 * `collectSnapshotPayload` is the real, DB-aware collector the snapshot
 * builder uses: node states are PROVEN from actual DetectorRun/
 * OperationalSignal data (GREEN = PROVEN OK), never assumed.
 * `emptySnapshotPayload` is a pure, DB-free fixture builder (all nodes
 * NO_DATA, nothing registered) — used by tests that need a valid payload
 * shape without exercising real detector collection.
 */
import type { DetectorRunStatus, PrismaClient, ReleaseEventKind } from "@prisma/client";

import { listDetectors } from "../detectorRegistry";
import { NODE_REGISTRY } from "../nodeRegistry";
import type { NodeKey, NodeState } from "../types";
import { collectDetectorSummaries, type DetectorSummary } from "./detectorSummaries";
import { projectNodeStates } from "./nodeProjection";

export interface OperationsSnapshotNode {
  key: NodeKey;
  state: NodeState;
}

export interface OperationsSnapshotDetectorSummary {
  name: string;
  lastOkAt: string | null;
  lastStatus: DetectorRunStatus | null;
  isStale: boolean;
}

export interface OperationsSnapshotRelease {
  kind: ReleaseEventKind;
  buildId: string;
  gitSha: string | null;
  processStartedAt: string;
  detectedAt: string;
}

/**
 * Internal ReleaseEvent comparison baseline (§21 Step 3). Stored on the
 * singleton snapshot so it survives worker restart. Not a proven change —
 * never exposed as a ReleaseEvent row by itself.
 */
export interface ObservedRuntimeBaseline {
  buildId: string;
  gitSha: string | null;
  processStartedAt: string;
}

export interface OperationsSnapshotPayload {
  nodes: OperationsSnapshotNode[];
  detectors: OperationsSnapshotDetectorSummary[];
  queues: Record<string, unknown>;
  kpis: Record<string, unknown>;
  release: OperationsSnapshotRelease | null;
  /** Internal only — comparison baseline for observeReleaseEvent. */
  observedRuntime?: ObservedRuntimeBaseline | null;
}

function toDetectorSummaryPayload(summary: DetectorSummary): OperationsSnapshotDetectorSummary {
  return {
    name: summary.name,
    lastOkAt: summary.lastOkAt ? summary.lastOkAt.toISOString() : null,
    lastStatus: summary.lastStatus,
    isStale: summary.isStale,
  };
}

/**
 * Real collection: node states are derived from actual registered
 * detectors' freshness + live signals. `now` should be the same DB
 * timestamp the caller captured as the snapshot's startedAt, so every
 * comparison in one build cycle is internally consistent.
 */
export async function collectSnapshotPayload(
  prisma: PrismaClient,
  now: Date,
  workerStartedAt: Date,
): Promise<OperationsSnapshotPayload> {
  const detectorSummaries = await collectDetectorSummaries(prisma, now, workerStartedAt);
  const nodes = await projectNodeStates(prisma, detectorSummaries);
  const [latestRelease, existingSnapshot] = await Promise.all([
    prisma.releaseEvent.findFirst({ orderBy: { detectedAt: "desc" } }),
    prisma.operationsSnapshot.findUnique({ where: { id: "current" } }),
  ]);

  const existingPayload = existingSnapshot?.payload as OperationsSnapshotPayload | null | undefined;
  const observedRuntime = existingPayload?.observedRuntime ?? null;

  return {
    nodes,
    detectors: detectorSummaries.map(toDetectorSummaryPayload),
    queues: {},
    kpis: {},
    release: latestRelease
      ? {
          kind: latestRelease.kind,
          buildId: latestRelease.buildId,
          gitSha: latestRelease.gitSha,
          processStartedAt: latestRelease.processStartedAt.toISOString(),
          detectedAt: latestRelease.detectedAt.toISOString(),
        }
      : null,
    // Preserve the ReleaseEvent comparison baseline across snapshot rebuilds
    // so a worker restart (or a plain snapshot cycle) cannot erase it.
    ...(observedRuntime ? { observedRuntime } : {}),
  };
}

/**
 * Pure, DB-free fixture: all v1 nodes NO_DATA, no detectors, no release —
 * the truthful shape when nothing is registered/known yet. Test fixture
 * only; the real worker always calls collectSnapshotPayload above.
 */
export function emptySnapshotPayload(): OperationsSnapshotPayload {
  return {
    nodes: NODE_REGISTRY.map((node) => ({ key: node.key, state: "NO_DATA" as NodeState })),
    detectors: listDetectors().map((d) => ({ name: d.name, lastOkAt: null, lastStatus: null, isStale: true })),
    queues: {},
    kpis: {},
    release: null,
  };
}
