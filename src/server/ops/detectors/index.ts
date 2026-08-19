/**
 * Detector registration (§21 Steps 3–4). Registers exactly seven
 * detectors, including the meta-detector — no more:
 *
 *   health_endpoint, db_degraded, detector_stale (Step 3)
 *   global_noindex, sitemap_unavailable, import_source_failed,
 *   moderation_queue_stale (Step 4)
 *
 * detector_stale derives its monitoring targets from DetectorRegistry at
 * runtime (excluding itself) — registering a detector here is the only
 * wiring it needs to also become covered by staleness monitoring.
 */
import { registerDetector } from "../detectorRegistry";
import { dbDegradedDetector } from "./dbDegraded";
import { detectorStaleDetector } from "./detectorStale";
import { globalNoindexDetector } from "./globalNoindex";
import { healthEndpointDetector } from "./healthEndpoint";
import { importSourceFailedDetector } from "./importSourceFailed";
import { moderationQueueStaleDetector } from "./moderationQueueStale";
import { sitemapUnavailableDetector } from "./sitemapUnavailable";

export function registerCoreDetectors(): void {
  registerDetector(healthEndpointDetector);
  registerDetector(dbDegradedDetector);
  registerDetector(detectorStaleDetector);
  registerDetector(globalNoindexDetector);
  registerDetector(sitemapUnavailableDetector);
  registerDetector(importSourceFailedDetector);
  registerDetector(moderationQueueStaleDetector);
}
