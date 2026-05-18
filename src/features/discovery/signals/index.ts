/**
 * Discovery Signals Module
 *
 * This module provides the foundation for discovery ranking and personalization.
 * It defines signal types, weights, and utilities for working with signals.
 *
 * IMPORTANT: This is architecture readiness only. No runtime changes to feed ranking.
 */

export {
  DISCOVERY_SIGNAL_WEIGHTS,
  SIGNAL_CATEGORIES,
  type DiscoverySignalType,
  type SignalCategory,
} from './discoverySignalWeights';

export type {
  DiscoverySignal,
  HighIntentSignal,
  ConversionSignal,
  SignalWeightMap,
  EntitySignalMetrics,
  UserSignalProfile,
} from './types';

export {
  getSignalWeight,
  isHighIntentSignal,
  isConversionSignal,
  getSignalCategory,
  isPassiveSignal,
  compareSignalsByWeight,
  calculateTotalWeight,
  groupSignalsByType,
  groupSignalsByCategory,
  filterSignalsByCategory,
  getSignalTypesInCategory,
} from './utils';
