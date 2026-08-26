import { getBudgetStep, roundUpBudget } from "@/lib/discovery/budgetUtils";

export type PriceDistributionBucket = { from: number; to: number; count: number };

export function buildPriceDistribution(values: number[]): { max: number | null; step: number | null; buckets: PriceDistributionBucket[] } {
  const prices = values.filter((value) => Number.isFinite(value) && value >= 0);
  if (prices.length === 0) return { max: null, step: null, buckets: [] };
  const max = roundUpBudget(Math.max(...prices));
  const sliderStep = getBudgetStep(max);
  const bucketCount = Math.max(1, Math.min(12, Math.ceil(Math.sqrt(prices.length))));
  const width = max === 0 ? 1 : max / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({ from: index * width, to: index === bucketCount - 1 ? max : (index + 1) * width, count: 0 }));
  prices.forEach((price) => {
    const index = max === 0 ? 0 : Math.min(bucketCount - 1, Math.floor(price / width));
    buckets[index]!.count += 1;
  });
  return { max, step: sliderStep, buckets };
}
