/**
 * ImportQualityService — quality scoring для импортированных записей.
 * Score не зависит от matching.
 */

import type {
  NormalizedPlaceImport,
  PlaceQualitySignals,
  QualityScoringResult,
  NormalizedEventImport,
  EventQualitySignals,
  EventQualityScoringResult,
} from "../types";

// ── PLACE scoring ─────────────────────────────────────────────────────────────

const PLACE_WEIGHTS: Record<keyof PlaceQualitySignals, number> = {
  hasTitle:       0.20,
  hasShortDesc:   0.15,
  hasDescription: 0.10,
  hasAddress:     0.15,
  hasCity:        0.10,
  hasCoords:      0.10,
  hasPhone:       0.05,
  hasWebsite:     0.05,
  hasImages:      0.05,
  hasCategories:  0.05,
};

export function scorePlaceImport(normalized: NormalizedPlaceImport): QualityScoringResult {
  const signals: PlaceQualitySignals = {
    hasTitle:       !!normalized.title?.trim(),
    hasShortDesc:   !!normalized.shortDescCandidate?.trim(),
    hasDescription: !!normalized.description?.trim(),
    hasAddress:     !!normalized.addressText?.trim(),
    hasCity:        !!normalized.cityName?.trim(),
    hasCoords:      normalized.lat != null && normalized.lng != null,
    hasPhone:       normalized.phones.length > 0,
    hasWebsite:     normalized.websites.length > 0,
    hasImages:      normalized.imageUrls.length > 0,
    hasCategories:  normalized.categoryCandidates.length > 0,
  };

  let score = 0;
  for (const [key, weight] of Object.entries(PLACE_WEIGHTS) as [keyof PlaceQualitySignals, number][]) {
    if (signals[key]) score += weight;
  }

  return { score: Math.round(score * 10000) / 10000, signals };
}

// ── EVENT scoring ─────────────────────────────────────────────────────────────

const EVENT_WEIGHTS: Record<keyof EventQualitySignals, number> = {
  hasTitle:                 0.20,
  hasShortDesc:             0.15,
  hasDescription:           0.10,
  hasTypeCandidate:         0.10,
  hasScheduleModeCandidate: 0.10,
  hasVenueOrAddress:        0.10,
  hasCity:                  0.05,
  hasStartAt:               0.10,
  hasCategories:            0.05,
  hasImages:                0.05,
};

export function scoreEventImport(normalized: NormalizedEventImport): EventQualityScoringResult {
  const signals: EventQualitySignals = {
    hasTitle:                 !!normalized.title?.trim(),
    hasShortDesc:             !!normalized.shortDescCandidate?.trim(),
    hasDescription:           !!normalized.description?.trim(),
    hasTypeCandidate:         !!normalized.typeCandidate?.trim(),
    hasScheduleModeCandidate: !!normalized.scheduleModeCandidate?.trim(),
    hasVenueOrAddress:        !!(normalized.venueName?.trim() || normalized.addressText?.trim()),
    hasCity:                  !!normalized.cityName?.trim(),
    hasStartAt:               !!(normalized.startAt?.trim() || normalized.scheduleText?.trim()),
    hasCategories:            normalized.categoryCandidates.length > 0,
    hasImages:                normalized.imageUrls.length > 0,
  };

  let score = 0;
  for (const [key, weight] of Object.entries(EVENT_WEIGHTS) as [keyof EventQualitySignals, number][]) {
    if (signals[key]) score += weight;
  }

  return { score: Math.round(score * 10000) / 10000, signals };
}
