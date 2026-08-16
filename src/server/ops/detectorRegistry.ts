/**
 * DetectorRegistry (§21 Step 2). Registration infrastructure only.
 *
 * MUST contain zero actual detectors in Step 2 — real detectors (
 * health_endpoint, db_degraded, detector_stale, global_noindex,
 * sitemap_unavailable, ...) are Step 3+ work. No fake/no-op detector is
 * registered here merely to exercise the framework; tests that need a
 * detector construct one locally, without registering it.
 */
import type { Detector } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const detectors = new Map<string, Detector<any>>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerDetector(detector: Detector<any>): void {
  if (detectors.has(detector.name)) {
    throw new Error(`Detector "${detector.name}" is already registered`);
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
