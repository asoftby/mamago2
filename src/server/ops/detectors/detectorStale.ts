/**
 * Detector #7 (meta-detector): detector_stale (§21 Step 3, Phase F).
 *
 * Iterates DetectorRegistry — NOT NodeRegistry — and excludes itself. A
 * detector may exist without belonging to any node; detector_stale still
 * covers it. Step 4 detectors are automatically covered once registered,
 * with zero code changes here.
 */
import type { PrismaClient } from "@prisma/client";

import { getDbNow } from "../dbTime";
import { computeDetectorFreshness } from "../detectorFreshness";
import { listDetectors } from "../detectorRegistry";
import type { Detector, DetectorContext, DetectorResult, SignalDraft } from "../types";

export const DETECTOR_STALE_NAME = "detector_stale";
export const DETECTOR_STALE_INTERVAL_SEC = 60;

export function detectorStaleFingerprint(detectorName: string): string {
  return `detector.stale:${detectorName}`;
}

export interface DetectorStaleTarget {
  name: string;
  intervalSec: number;
  /** Most recent DetectorRun with status=OK for this detector, or null. */
  lastOkAt: Date | null;
}

export interface DetectorStaleProbe {
  now: Date;
  workerStartedAt: Date;
  targets: DetectorStaleTarget[];
}

async function getLastOkAt(prisma: PrismaClient, detectorName: string): Promise<Date | null> {
  const run = await prisma.detectorRun.findFirst({
    where: { detector: detectorName, status: "OK" },
    orderBy: { finishedAt: "desc" },
    select: { finishedAt: true },
  });
  return run?.finishedAt ?? null;
}

export async function probeDetectorStale(ctx: DetectorContext): Promise<DetectorStaleProbe> {
  const now = await getDbNow(ctx.prisma);
  const others = listDetectors().filter((d) => d.name !== DETECTOR_STALE_NAME);
  const targets = await Promise.all(
    others.map(async (d) => ({
      name: d.name,
      intervalSec: d.intervalSec,
      lastOkAt: await getLastOkAt(ctx.prisma, d.name),
    })),
  );
  return { now, workerStartedAt: ctx.workerStartedAt, targets };
}

export function evaluateDetectorStale(probe: DetectorStaleProbe): DetectorResult {
  const signals: SignalDraft[] = [];

  for (const target of probe.targets) {
    const freshness = computeDetectorFreshness({
      intervalSec: target.intervalSec,
      lastOkAt: target.lastOkAt,
      now: probe.now,
      workerStartedAt: probe.workerStartedAt,
    });

    if (freshness.isStale && !freshness.inColdStartGrace) {
      signals.push({
        fingerprint: detectorStaleFingerprint(target.name),
        type: "DETECTOR_STALE",
        severity: "CRITICAL",
        title: `Detector "${target.name}" has not completed successfully recently`,
        summary: target.lastOkAt
          ? `Last successful run at ${target.lastOkAt.toISOString()}, exceeds 3x interval (${target.intervalSec}s)`
          : "Never completed a successful run",
        entityType: "detector",
        entityId: target.name,
      });
    }
  }

  return { samples: [], signals };
}

export const detectorStaleDetector: Detector<DetectorStaleProbe> = {
  name: DETECTOR_STALE_NAME,
  intervalSec: DETECTOR_STALE_INTERVAL_SEC,
  timeoutMs: 5_000,
  nodes: ["Operations"],
  probe: probeDetectorStale,
  evaluate: evaluateDetectorStale,
};
