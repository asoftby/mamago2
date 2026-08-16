/**
 * Core detector registration (§21 Step 3, Phase G). Registers exactly:
 * health_endpoint, db_degraded, detector_stale — no more. Step 4 detectors
 * (global_noindex, sitemap_unavailable, ...) are not registered here.
 */
import { registerDetector } from "../detectorRegistry";
import { dbDegradedDetector } from "./dbDegraded";
import { detectorStaleDetector } from "./detectorStale";
import { healthEndpointDetector } from "./healthEndpoint";

export function registerCoreDetectors(): void {
  registerDetector(healthEndpointDetector);
  registerDetector(dbDegradedDetector);
  registerDetector(detectorStaleDetector);
}
