/**
 * DetectorRegistry (§21 Step 2, populated starting Step 3).
 *
 * Step 3 registers exactly health_endpoint, db_degraded, detector_stale —
 * see src/server/ops/detectors/index.ts. global_noindex,
 * sitemap_unavailable, and other Step 4+ detectors are not registered here.
 */
import type { Detector } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const detectors = new Map<string, Detector<any>>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerDetector(detector: Detector<any>): void {
  if (detectors.has(detector.name)) {
    throw new Error(`Detector "${detector.name}" is already registered`);
  }
  if (detector.hysteresis) {
    const { open, close } = detector.hysteresis;
    if (!(close > open)) {
      throw new Error(
        `Detector "${detector.name}" has invalid hysteresis: close (${close}) must be > open (${open})`,
      );
    }
  }
  detectors.set(detector.name, detector);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listDetectors(): Detector<any>[] {
  return Array.from(detectors.values());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDetector(name: string): Detector<any> | undefined {
  return detectors.get(name);
}

/** Test-only: clears all registrations. Never call from production code. */
export function __resetDetectorRegistryForTests(): void {
  detectors.clear();
}
