/**
 * Discovery Signal Utilities
 *
 * Helper functions for working with discovery signals.
 * These utilities are pure functions with no database dependencies.
 */

import {
  DISCOVERY_SIGNAL_WEIGHTS,
  SIGNAL_CATEGORIES,
  type DiscoverySignalType,
  type SignalCategory,
} from './discoverySignalWeights';
import type {
  ConversionSignal,
  HighIntentSignal,
  DiscoverySignal,
} from './types';

/**
 * Get the weight for a specific signal type
 *
 * @param signalType - The type of signal
 * @returns The weight value
 *
 * @example
 * const weight = getSignalWeight('BOOKING_COMPLETED'); // 100
 */
export function getSignalWeight(signalType: DiscoverySignalType): number {
  return DISCOVERY_SIGNAL_WEIGHTS[signalType];
}

/**
 * Check if a signal type represents high user intent
 *
 * High-intent signals indicate the user is seriously considering an action:
 * - SAVE: User explicitly saved the entity
 * - PLAN_ADD: User added to their plan
 * - CTA_CLICK: User clicked a call-to-action
 *
 * @param signalType - The type of signal
 * @returns true if this is a high-intent signal
 *
 * @example
 * isHighIntentSignal('SAVE'); // true
 * isHighIntentSignal('CARD_VIEW'); // false
 */
export function isHighIntentSignal(
  signalType: DiscoverySignalType
): signalType is HighIntentSignal {
  return ['SAVE', 'PLAN_ADD', 'CTA_CLICK'].includes(signalType);
}

/**
 * Check if a signal type represents a conversion
 *
 * Conversion signals indicate completed transactions or strong commitments:
 * - BOOKING_CREATED: User initiated a booking
 * - BOOKING_CONFIRMED: User confirmed a booking
 * - BOOKING_COMPLETED: User completed a booking
 * - FEEDBACK_LEFT: User provided feedback
 *
 * @param signalType - The type of signal
 * @returns true if this is a conversion signal
 *
 * @example
 * isConversionSignal('BOOKING_COMPLETED'); // true
 * isConversionSignal('SAVE'); // false
 */
export function isConversionSignal(
  signalType: DiscoverySignalType
): signalType is ConversionSignal {
  return [
    'BOOKING_CREATED',
    'BOOKING_CONFIRMED',
    'BOOKING_COMPLETED',
    'FEEDBACK_LEFT',
  ].includes(signalType);
}

/**
 * Get the category of a signal type
 *
 * @param signalType - The type of signal
 * @returns The category this signal belongs to
 *
 * @example
 * getSignalCategory('BOOKING_COMPLETED'); // 'CONVERSION'
 * getSignalCategory('CARD_VIEW'); // 'PASSIVE'
 */
export function getSignalCategory(
  signalType: DiscoverySignalType
): SignalCategory {
  for (const [category, signals] of Object.entries(SIGNAL_CATEGORIES)) {
    if (signals.includes(signalType as never)) {
      return category as SignalCategory;
    }
  }
  throw new Error(`Unknown signal type: ${signalType}`);
}

/**
 * Check if a signal is passive engagement
 *
 * Passive signals indicate basic awareness but low commitment:
 * - CARD_VIEW: User viewed a card
 * - DETAIL_OPEN: User opened details
 *
 * @param signalType - The type of signal
 * @returns true if this is a passive signal
 */
export function isPassiveSignal(signalType: DiscoverySignalType): boolean {
  return SIGNAL_CATEGORIES.PASSIVE.includes(signalType as never);
}

/**
 * Compare two signals by weight
 *
 * Useful for sorting signals by importance
 *
 * @param signalA - First signal
 * @param signalB - Second signal
 * @returns Negative if A < B, positive if A > B, 0 if equal
 *
 * @example
 * signals.sort(compareSignalsByWeight); // Highest weight first
 */
export function compareSignalsByWeight(
  signalA: DiscoverySignal,
  signalB: DiscoverySignal
): number {
  return signalB.weight - signalA.weight;
}

/**
 * Calculate the total weight of multiple signals
 *
 * @param signals - Array of signals
 * @returns Sum of all signal weights
 *
 * @example
 * const total = calculateTotalWeight(signals); // 250
 */
export function calculateTotalWeight(signals: DiscoverySignal[]): number {
  return signals.reduce((sum, signal) => sum + signal.weight, 0);
}

/**
 * Group signals by type
 *
 * @param signals - Array of signals
 * @returns Map of signal type to array of signals
 *
 * @example
 * const grouped = groupSignalsByType(signals);
 * grouped.get('BOOKING_COMPLETED'); // [signal1, signal2]
 */
export function groupSignalsByType(
  signals: DiscoverySignal[]
): Map<DiscoverySignalType, DiscoverySignal[]> {
  const grouped = new Map<DiscoverySignalType, DiscoverySignal[]>();

  for (const signal of signals) {
    if (!grouped.has(signal.type)) {
      grouped.set(signal.type, []);
    }
    grouped.get(signal.type)!.push(signal);
  }

  return grouped;
}

/**
 * Group signals by category
 *
 * @param signals - Array of signals
 * @returns Map of category to array of signals
 *
 * @example
 * const grouped = groupSignalsByCategory(signals);
 * grouped.get('CONVERSION'); // [signal1, signal2]
 */
export function groupSignalsByCategory(
  signals: DiscoverySignal[]
): Map<SignalCategory, DiscoverySignal[]> {
  const grouped = new Map<SignalCategory, DiscoverySignal[]>();

  for (const signal of signals) {
    const category = getSignalCategory(signal.type);
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(signal);
  }

  return grouped;
}

/**
 * Filter signals by category
 *
 * @param signals - Array of signals
 * @param category - Category to filter by
 * @returns Signals matching the category
 *
 * @example
 * const conversions = filterSignalsByCategory(signals, 'CONVERSION');
 */
export function filterSignalsByCategory(
  signals: DiscoverySignal[],
  category: SignalCategory
): DiscoverySignal[] {
  const categorySignals = SIGNAL_CATEGORIES[category];
  return signals.filter((signal) =>
    categorySignals.includes(signal.type as never)
  );
}

/**
 * Get all signal types in a category
 *
 * @param category - The category
 * @returns Array of signal types in this category
 *
 * @example
 * getSignalTypesInCategory('CONVERSION');
 * // ['BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_COMPLETED', 'FEEDBACK_LEFT']
 */
export function getSignalTypesInCategory(
  category: SignalCategory
): DiscoverySignalType[] {
  return [...SIGNAL_CATEGORIES[category]];
}
