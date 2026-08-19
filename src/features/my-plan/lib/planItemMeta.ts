/**
 * The only field allowed in My Plan's category/meta slot: a real structured
 * category/type. Never falls back to price, description, scheduleJson, or
 * any other marketing text — those must never occupy this slot. Returns
 * null (slot omitted entirely) when there is no real category, rather than
 * inventing one.
 */
export function resolvePlanItemCategoryLabel(
  activity: { categoryLabel: string | null } | null,
): string | null {
  const trimmed = activity?.categoryLabel?.trim();
  return trimmed ? trimmed : null;
}
