/**
 * Per-detector freshness summaries for the snapshot payload (§21 Step 3,
 * Phase H): name, lastOkAt, lastStatus, isStale — for every currently
 * registered detector.
 */
import type { DetectorRunStatus, PrismaClient } from "@prisma/client";

import { computeDetectorFreshness } from "../detectorFreshness";
import { listDetectors } from "../detectorRegistry";

export interface DetectorSummary {
  name: string;
  lastOkAt: Date | null;
  lastStatus: DetectorRunStatus | null;
  isStale: boolean;
}

export async function collectDetectorSummaries(
  prisma: PrismaClient,
  now: Date,
  workerStartedAt: Date,
): Promise<DetectorSummary[]> {
  const detectors = listDetectors();

  return Promise.all(
    detectors.map(async (detector): Promise<DetectorSummary> => {
      const [lastOkRun, latestRun] = await Promise.all([
        prisma.detectorRun.findFirst({
          where: { detector: detector.name, status: "OK" },
          orderBy: { finishedAt: "desc" },
          select: { finishedAt: true },
        }),
        prisma.detectorRun.findFirst({
          where: { detector: detector.name },
          orderBy: { startedAt: "desc" },
          select: { status: true },
        }),
      ]);

      const lastOkAt = lastOkRun?.finishedAt ?? null;
      const { isStale } = computeDetectorFreshness({
        intervalSec: detector.intervalSec,
        lastOkAt,
        now,
        workerStartedAt,
      });

      return { name: detector.name, lastOkAt, lastStatus: latestRun?.status ?? null, isStale };
    }),
  );
}
