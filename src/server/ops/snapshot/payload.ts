/**
 * OperationsSnapshot payload contract (§21 Step 2, Phase L).
 *
 * Step 2 always produces the same content shape: four v1 nodes, all
 * NO_DATA (no covering detector has ever run — DetectorRegistry is empty),
 * no detectors, no queues, no kpis, no release. Nothing here queries
 * business/product data — that would be a runtime COUNT(*) dashboard,
 * explicitly out of scope.
 */
import { NODE_REGISTRY } from "../nodeRegistry";
import type { NodeKey, NodeState } from "../types";

export interface OperationsSnapshotNode {
  key: NodeKey;
  state: NodeState;
}

export interface OperationsSnapshotPayload {
  nodes: OperationsSnapshotNode[];
  detectors: unknown[];
  queues: Record<string, unknown>;
  kpis: Record<string, unknown>;
  release: unknown | null;
}

/**
 * Step 2 payload: truthfully NO_DATA everywhere, because zero detectors
 * exist yet to prove anything OK/WARNING/CRITICAL.
 */
export function collectSnapshotPayload(): OperationsSnapshotPayload {
  return {
    nodes: NODE_REGISTRY.map((node) => ({ key: node.key, state: "NO_DATA" as NodeState })),
    detectors: [],
    queues: {},
    kpis: {},
    release: null,
  };
}
