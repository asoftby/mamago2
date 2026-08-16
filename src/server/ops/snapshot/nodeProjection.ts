/**
 * Node-state projection (§21 Step 3, Phase H).
 *
 * Precedence: NO_DATA > CRITICAL > WARNING > OK.
 *
 *   NO_DATA  if the node has no currently-registered required detector, or
 *            any required detector never ran OK or is stale.
 *   CRITICAL if a live (OPEN) CRITICAL signal exists from a required detector.
 *   WARNING  if a live (OPEN) WARNING signal exists and no CRITICAL.
 *   OK       only when every required detector is fresh/successful and
 *            there is no live signal at all — GREEN = PROVEN OK, never
 *            assumed from "no error was seen".
 *
 * Snoozed signals still count here — snooze only hides a signal from a
 * display list, it must never turn a node green. This query deliberately
 * does not filter on snoozedUntil.
 *
 * A node's "required detectors" is the intersection of its frozen
 * futureCoverage list (nodeRegistry.ts) with the names currently
 * registered in DetectorRegistry — so Indexability (no Step 3 detector
 * registered under "global_noindex"/"sitemap_unavailable") has an empty
 * intersection and is forced NO_DATA, never vacuously OK.
 */
import type { PrismaClient } from "@prisma/client";

import { listDetectors } from "../detectorRegistry";
import { NODE_REGISTRY } from "../nodeRegistry";
import type { NodeState } from "../types";
import type { DetectorSummary } from "./detectorSummaries";
import type { OperationsSnapshotNode } from "./payload";

export async function projectNodeStates(
  prisma: PrismaClient,
  detectorSummaries: DetectorSummary[],
): Promise<OperationsSnapshotNode[]> {
  const registeredNames = new Set(listDetectors().map((d) => d.name));
  const summaryByName = new Map(detectorSummaries.map((s) => [s.name, s]));

  const nodes: OperationsSnapshotNode[] = [];

  for (const node of NODE_REGISTRY) {
    const requiredDetectors = node.futureCoverage.filter((name) => registeredNames.has(name));

    if (requiredDetectors.length === 0) {
      nodes.push({ key: node.key, state: "NO_DATA" });
      continue;
    }

    const anyStale = requiredDetectors.some((name) => summaryByName.get(name)?.isStale ?? true);
    if (anyStale) {
      nodes.push({ key: node.key, state: "NO_DATA" });
      continue;
    }

    const liveSignals = await prisma.operationalSignal.findMany({
      where: { detector: { in: requiredDetectors }, status: "OPEN" },
      select: { severity: true },
    });

    const hasCritical = liveSignals.some((s) => s.severity === "CRITICAL");
    const hasWarning = liveSignals.some((s) => s.severity === "WARNING");
    const state: NodeState = hasCritical ? "CRITICAL" : hasWarning ? "WARNING" : "OK";
    nodes.push({ key: node.key, state });
  }

  return nodes;
}
