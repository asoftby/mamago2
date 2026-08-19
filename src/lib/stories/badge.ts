/** Max value shown after the plus in the ring badge (e.g. +9). */
export const STORY_BADGE_DISPLAY_CAP = 9;

/**
 * Badge "+N" extra count from a real item total.
 * Internal `counts` keep the true total for `minItems`; only the UI caps.
 *
 * Matches current ring UX: badge hidden when total ≤ 1; otherwise +(total−1).
 */
export function formatStoryBadgeExtra(totalCount: number): string | null {
  if (totalCount <= 1) return null;
  const extra = Math.min(totalCount - 1, STORY_BADGE_DISPLAY_CAP);
  return `+${extra}`;
}
