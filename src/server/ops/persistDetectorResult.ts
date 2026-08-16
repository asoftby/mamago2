/**
 * Generic detector-result persistence (§21 Step 3, Phases B/M).
 * Wires reconciliation + append-only MetricSample writes into the
 * executor's `persistResult` seam. Only ever invoked on a successful
 * (OK) DetectorRun — see executeDetector in detectorRun.ts.
 */
import type { PrismaClient } from "@prisma/client";

import type { DetectorRunCounts } from "./detectorRun";
import { reconcileDetectorSignals } from "./reconciliation";
import type { DetectorHysteresis, DetectorResult } from "./types";

export async function persistDetectorResult(
  prisma: PrismaClient,
  detectorName: string,
  result: DetectorResult,
  hysteresis?: DetectorHysteresis,
): Promise<DetectorRunCounts> {
  let samplesWritten = 0;
  if (result.samples.length > 0) {
    const written = await prisma.metricSample.createMany({
      data: result.samples.map((sample) => ({
        metric: sample.metric,
        dimKey: sample.dimKey ?? "",
        value: sample.value,
      })),
    });
    samplesWritten = written.count;
  }

  const { signalsOpened, signalsResolved } = await reconcileDetectorSignals(
    prisma,
    detectorName,
    result.signals,
    hysteresis,
  );

  return { signalsOpened, signalsResolved, samplesWritten };
}
