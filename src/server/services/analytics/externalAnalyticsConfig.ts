import "server-only";
import type { ExternalAnalyticsConfig } from "@/lib/analytics/externalAnalyticsTypes";
import { resolveExternalAnalyticsConfig } from "@/lib/analytics/externalAnalyticsConfig";

/**
 * Read external analytics IDs at server runtime, not from NEXT_PUBLIC build
 * variables, so immutable images are not tied to one measurement property.
 */
export function getExternalAnalyticsConfig(): ExternalAnalyticsConfig {
  return resolveExternalAnalyticsConfig(process.env);
}
