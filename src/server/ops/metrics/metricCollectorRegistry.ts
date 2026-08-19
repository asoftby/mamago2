/**
 * MetricCollectorRegistry (§21 Step 5, Phase B) — deliberately separate
 * from DetectorRegistry. Explicit entries only, registered in
 * collectors/index.ts; no reflection/file-system discovery.
 */
import type { MetricCollector } from "./types";

const collectors = new Map<string, MetricCollector>();

export function registerMetricCollector(collector: MetricCollector): void {
  if (collectors.has(collector.name)) {
    throw new Error(`Metric collector "${collector.name}" is already registered`);
  }
  collectors.set(collector.name, collector);
}

export function listMetricCollectors(): MetricCollector[] {
  return Array.from(collectors.values());
}

/** Test-only: clears all registrations. Never call from production code. */
export function __resetMetricCollectorRegistryForTests(): void {
  collectors.clear();
}
