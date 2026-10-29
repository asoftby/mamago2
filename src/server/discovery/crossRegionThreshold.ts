/**
 * Optional regional thresholds, keyed by Region.slug:
 * CROSS_REGION_FAMILY_THRESHOLDS='{"minskaya-oblast":50,"brestskaya-oblast":75}'
 * Invalid entries fail closed to the default, never to zero.
 */
export const DEFAULT_CROSS_REGION_FAMILY_THRESHOLD = 50;

export function getCrossRegionFamilyThreshold(
  regionSlug: string | null | undefined,
  rawConfig: string | undefined = process.env.CROSS_REGION_FAMILY_THRESHOLDS,
): number {
  if (!regionSlug || !rawConfig) return DEFAULT_CROSS_REGION_FAMILY_THRESHOLD;
  try {
    const parsed: unknown = JSON.parse(rawConfig);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return DEFAULT_CROSS_REGION_FAMILY_THRESHOLD;
    const threshold = (parsed as Record<string, unknown>)[regionSlug];
    return typeof threshold === "number" && Number.isSafeInteger(threshold) && threshold >= 1 && threshold <= 1_000_000
      ? threshold
      : DEFAULT_CROSS_REGION_FAMILY_THRESHOLD;
  } catch {
    return DEFAULT_CROSS_REGION_FAMILY_THRESHOLD;
  }
}
