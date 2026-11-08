/**
 * Tunable rules for filler places in the day scenario (BACKLOG-230, PR 1b).
 * Utilities share the engine's 0-100 scale: events occupy 25-100, fillers sit below.
 */
export const FILLER_CONFIG = {
  /** Default visit length of a filler place. */
  defaultDurationMin: 90,
  /** Shorter stop for cafes. Matched by primary-category slug or Russian name. */
  durationMinByCategorySlug: { food: 60 } as Record<string, number>,
  durationMinByCategoryName: { "Кафе и еда": 60 } as Record<string, number>,
  /** Base utility of a filler with confirmed opening hours. */
  baseUtility: 18,
  /** Subtracted when the place has no hours record. */
  unknownHoursPenalty: 8,
  /**
   * Subtracted from an event whose time is only derived from its schedule rules (no ActivitySession). Small on
   * purpose: such an event is a full anchor, only a notch below a confirmed session of the same score. It must
   * stay above BASE_UTILITY even at the bottom of the event scale (EVENT_UTILITY_FLOOR - penalty > baseUtility),
   * otherwise a filler place always wins and a recurring event can never be chosen.
   */
  virtualSessionPenalty: 4,
  /** Places without a primary category join the pool, but only this many per scenario. */
  maxUncategorizedPerScenario: 1,
  /** Candidate start times inside opening hours are generated on this grid. */
  slotStepMin: 30,
  maxSlotsPerPlace: 24,
} as const;

/** Utility of a dated event = floor + (100 - floor) * (score ratio to the best event). */
export const EVENT_UTILITY_FLOOR = 25;

export function fillerDurationMin(category: { slug?: string | null; nameRu?: string | null } | null): number {
  if (category?.slug && category.slug in FILLER_CONFIG.durationMinByCategorySlug) {
    return FILLER_CONFIG.durationMinByCategorySlug[category.slug]!;
  }
  if (category?.nameRu && category.nameRu in FILLER_CONFIG.durationMinByCategoryName) {
    return FILLER_CONFIG.durationMinByCategoryName[category.nameRu]!;
  }
  return FILLER_CONFIG.defaultDurationMin;
}
