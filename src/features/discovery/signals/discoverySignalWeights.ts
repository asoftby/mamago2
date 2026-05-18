/**
 * Discovery Signal Weights
 *
 * These weights represent the relative importance of different user interactions
 * for future ranking, personalization, and quality scoring systems.
 *
 * IMPORTANT: These are STATIC WEIGHTS for architecture readiness only.
 * They are NOT used in runtime calculations or feed ranking.
 * They serve as the foundation for future discovery intelligence systems.
 *
 * Signal Philosophy:
 * - Lower weights: Passive engagement (views, clicks)
 * - Medium weights: Active intent (saves, plan additions)
 * - Higher weights: Conversion signals (bookings, completions)
 * - Highest weights: Quality signals (feedback, repeat bookings)
 */

export const DISCOVERY_SIGNAL_WEIGHTS = {
  // Passive engagement signals
  CARD_VIEW: 1,
  DETAIL_OPEN: 3,

  // Active intent signals
  SAVE: 5,
  PLAN_ADD: 25,

  // Interaction signals
  CTA_CLICK: 30,

  // Conversion signals
  BOOKING_CREATED: 40,
  BOOKING_CONFIRMED: 70,
  BOOKING_COMPLETED: 100,

  // Quality signals
  FEEDBACK_LEFT: 120,
} as const;

/**
 * Signal categories for future aggregation
 */
export const SIGNAL_CATEGORIES = {
  PASSIVE: ['CARD_VIEW', 'DETAIL_OPEN'],
  INTENT: ['SAVE', 'PLAN_ADD'],
  INTERACTION: ['CTA_CLICK'],
  CONVERSION: ['BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_COMPLETED'],
  QUALITY: ['FEEDBACK_LEFT'],
} as const;

/**
 * Type-safe signal weight keys
 */
export type DiscoverySignalType = keyof typeof DISCOVERY_SIGNAL_WEIGHTS;

/**
 * Type-safe signal category keys
 */
export type SignalCategory = keyof typeof SIGNAL_CATEGORIES;
