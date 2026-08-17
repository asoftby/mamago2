/**
 * Backend Operations read contract (§21 Step 2, Phases N/O/Q).
 * Following §19's `getOperationsView(userId)` shape.
 *
 * Read path only touches OperationsSnapshot (PK), OperationsViewState (PK),
 * and an indexed OperationalSignal query — no MetricSample scans, no
 * product aggregates, no external requests, no runtime COUNT(*).
 */
import type { PrismaClient, OperationalSignal } from "@prisma/client";

import sharedPrisma from "@/lib/prisma";
import { NODE_REGISTRY } from "../nodeRegistry";
import type { NodeKey, NodeState } from "../types";
import type { OperationsSnapshotPayload } from "../snapshot/payload";
import { correlateSignalReleases, type CorrelatedRelease } from "./correlateReleaseEvents";

export const SNAPSHOT_INTERVAL_SEC = 60;
/** max(3 * SNAPSHOT_INTERVAL_SEC, 300) = 300 seconds, per the frozen contract. */
export const STALE_THRESHOLD_SEC = Math.max(3 * SNAPSHOT_INTERVAL_SEC, 300);

export const OPERATIONS_DATA_STALE_FINGERPRINT = "synthetic:operations-data-stale";

export interface OperationsSyntheticSignal {
  fingerprint: string;
  type: "OPERATIONS_DATA_STALE";
  severity: "CRITICAL";
  title: string;
}

export interface OperationsViewNode {
  key: NodeKey;
  state: NodeState;
}

export interface OperationsView {
  stale: boolean;
  generatedAt: Date | null;
  nodes: OperationsViewNode[];
  detectors: unknown[];
  queues: Record<string, unknown>;
  kpis: Record<string, unknown>;
  release: unknown | null;
  /** Never persisted, never acknowledged/snoozed, no hysteresis — present only while stale. */
  syntheticSignals: OperationsSyntheticSignal[];
  /** OPEN, non-snoozed OperationalSignal rows. */
  signals: OperationalSignal[];
  /** Per-signal ReleaseEvent within openedAt ±30min, keyed by signal id. */
  signalReleases: Record<string, CorrelatedRelease | null>;
  /** The PREVIOUS lastViewedAt, read before this call updates it. */
  lastViewedAt: Date | null;
}

function allNodesNoData(): OperationsViewNode[] {
  return NODE_REGISTRY.map((node) => ({ key: node.key, state: "NO_DATA" as NodeState }));
}

function staleSyntheticSignal(): OperationsSyntheticSignal {
  return {
    fingerprint: OPERATIONS_DATA_STALE_FINGERPRINT,
    type: "OPERATIONS_DATA_STALE",
    severity: "CRITICAL",
    title: "Operations data is stale",
  };
}

/**
 * Testable core: accepts an injected PrismaClient so tests can point at an
 * isolated database, per the same strategy proven in Step 1. Production
 * code should call `getOperationsView(userId)` below instead.
 */
export async function getOperationsViewWithClient(
  prisma: PrismaClient,
  userId: string,
): Promise<OperationsView> {
  const [snapshot, viewState, openSignals] = await Promise.all([
    prisma.operationsSnapshot.findUnique({ where: { id: "current" } }),
    prisma.operationsViewState.findUnique({ where: { userId } }),
    prisma.operationalSignal.findMany({
      where: {
        status: "OPEN",
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: new Date() } }],
      },
      orderBy: [{ severity: "asc" }, { openedAt: "asc" }],
    }),
  ]);

  const ageSec = snapshot ? (Date.now() - snapshot.generatedAt.getTime()) / 1000 : Infinity;
  const stale = !snapshot || ageSec > STALE_THRESHOLD_SEC;

  // Read previous lastViewedAt BEFORE forming/returning the response — the
  // update below happens only after `view` is fully built.
  const previousLastViewedAt = viewState?.lastViewedAt ?? null;

  const payload = snapshot?.payload as unknown as OperationsSnapshotPayload | undefined;

  // One bounded query covering every visible signal's ±30min window —
  // shown regardless of `stale`, since OPEN incidents remain real facts
  // even when the snapshot's own node-state computation is stale.
  const signalReleases = await correlateSignalReleases(prisma, openSignals);

  const view: OperationsView = stale
    ? {
        stale: true,
        generatedAt: snapshot?.generatedAt ?? null,
        nodes: allNodesNoData(),
        detectors: [],
        queues: {},
        kpis: {},
        release: null,
        syntheticSignals: [staleSyntheticSignal()],
        signals: openSignals,
        signalReleases,
        lastViewedAt: previousLastViewedAt,
      }
    : {
        stale: false,
        generatedAt: snapshot!.generatedAt,
        // Materialized straight from the snapshot payload — the web
        // process never recomputes detector health itself.
        nodes: payload!.nodes,
        detectors: payload!.detectors,
        queues: payload!.queues,
        kpis: payload!.kpis,
        release: payload!.release,
        syntheticSignals: [],
        signals: openSignals,
        signalReleases,
        lastViewedAt: previousLastViewedAt,
      };

  await prisma.operationsViewState.upsert({
    where: { userId },
    create: { userId },
    update: { lastViewedAt: new Date() },
  });

  return view;
}

export async function getOperationsView(userId: string): Promise<OperationsView> {
  return getOperationsViewWithClient(sharedPrisma, userId);
}
