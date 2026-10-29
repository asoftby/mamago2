import { roundUpBudget } from "@/lib/discovery/budgetUtils";

export type PriceDistributionBucket = { from: number; to: number; count: number };

export function buildPriceDistribution(values: number[]): { max: number | null; maxPrice: number | null; minPaid: number | null; step: number | null; buckets: PriceDistributionBucket[] } {
  const prices = values.filter((value) => Number.isFinite(value) && value >= 0);
  if (!prices.length) return { max: null, maxPrice: null, minPaid: null, step: null, buckets: [] };
  const paid = prices.filter((price) => price > 0);
  const minPaid = paid.length ? Math.min(...paid) : null;
  const maxPrice = Math.max(...prices);
  const max = roundUpBudget(maxPrice);
  if (minPaid == null) return { max, maxPrice, minPaid: null, step: 1, buckets: [] };

  // Match the slider's integer domain, not the old 0-to-rounded-max domain.
  const lower = Math.floor(minPaid);
  const upper = Math.ceil(maxPrice);
  const bucketCount = Math.max(1, Math.min(12, Math.ceil(Math.sqrt(paid.length))));
  const width = upper > lower ? (upper - lower) / bucketCount : 1;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    from: lower + index * width,
    to: index === bucketCount - 1 ? upper : lower + (index + 1) * width,
    count: 0,
  }));
  paid.forEach((price) => {
    const index = upper <= lower ? 0 : Math.min(bucketCount - 1, Math.floor((price - lower) / width));
    buckets[index]!.count += 1;
  });
  return { max, maxPrice, minPaid, step: 1, buckets };
}
