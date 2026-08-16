/**
 * Frozen v1 NodeRegistry (§21 Step 2). Independent from DetectorRegistry —
 * a detector may exist without belonging to a node, and a node's covering
 * detectors are purely descriptive metadata here (informational for future
 * steps), not a live binding.
 *
 * v1 nodes are exactly these four. Do not add Import/Notifications/
 * Telemetry/Search — those are explicitly out of the v1 node strip.
 */
import type { NodeKey } from "./types";

export interface NodeDefinition {
  key: NodeKey;
  label: string;
  /** Detector names expected to eventually cover this node (Steps 3–4). None exist yet. */
  futureCoverage: string[];
}

export const NODE_REGISTRY: readonly NodeDefinition[] = [
  {
    key: "PROD",
    label: "PROD",
    futureCoverage: ["health_endpoint"],
  },
  {
    key: "DB",
    label: "DB",
    futureCoverage: ["db_degraded"],
  },
  {
    key: "Operations",
    label: "Operations",
    futureCoverage: ["snapshot_freshness", "detector_stale"],
  },
  {
    key: "Indexability",
    label: "Indexability",
    futureCoverage: ["global_noindex", "sitemap_unavailable"],
  },
];

export const NODE_KEYS: readonly NodeKey[] = NODE_REGISTRY.map((n) => n.key);
