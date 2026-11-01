/**
 * Compress a persisted catalogue age label for a compact My Plan event badge.
 * A catalogue event may still have legacy comma-separated group labels.
 * Preserve non-range copy instead of guessing restrictions.
 */
export function formatPlanAgeLabel(label: string | null | undefined): string | null {
  const original = label?.trim();
  if (!original) return null;

  const ranges = [...original.matchAll(/(\d{1,2})\s*[-–—]\s*(\d{1,2})(?:\s*(?:лет|года|год))?/g)]
    .map((match) => ({ from: Number(match[1]), to: Number(match[2]) }))
    .filter(({ from, to }) => from <= to);
  const hasOpenEndedGroup = /(?:^|[,;\s])18\s*\+(?=$|[,;\s])/.test(original) || /#nokids/i.test(original);
  if (ranges.length === 0) return hasOpenEndedGroup ? "18+" : original;

  const min = Math.min(...ranges.map(({ from }) => from), ...(hasOpenEndedGroup ? [18] : []));
  if (hasOpenEndedGroup) return `${min}+`;

  const max = Math.max(...ranges.map(({ to }) => to));
  const unit = max === 1 ? "год" : max >= 2 && max <= 4 ? "года" : "лет";
  return `${min}–${max} ${unit}`;
}
