/**
 * Place Match Scorer
 *
 * Считает score для пары (NormalizedPlaceImport, PlaceCandidate).
 * Возвращает PlaceMatchCandidate с breakdown сигналов.
 */

import type { NormalizedPlaceImport, PlaceMatchCandidate, PlaceMatchSignals } from "../types";
import type { PlaceCandidate } from "./place-candidate-search";
import {
  normalizeTitle,
  normalizePhone,
  normalizeWebsiteDomain,
  normalizeAddress,
  haversineMeters,
  tokenJaccard,
} from "../utils/string-normalize";

// ── Веса компонентов (сумма = 1.0) ───────────────────────────────────────────
const W = {
  websiteDomainExact: 0.35,
  phoneExact:         0.30,
  titleSimilarity:    0.20,
  addressSimilarity:  0.10,
  coordsProximity:    0.05,
} as const;

/** Порог расстояния в метрах для полного score coords */
const COORDS_FULL_MATCH_M = 100;
/** Порог расстояния в метрах — дальше score = 0 */
const COORDS_MAX_M = 2000;

function coordsScore(distanceM: number): number {
  if (distanceM <= COORDS_FULL_MATCH_M) return 1;
  if (distanceM >= COORDS_MAX_M) return 0;
  return 1 - (distanceM - COORDS_FULL_MATCH_M) / (COORDS_MAX_M - COORDS_FULL_MATCH_M);
}

function buildReason(signals: PlaceMatchSignals, score: number): string {
  const parts: string[] = [];
  if (signals.websiteDomainExact) parts.push("website domain match");
  if (signals.phoneExact) parts.push("phone match");
  if (signals.titleSimilarity >= 0.8) parts.push(`title ~${Math.round(signals.titleSimilarity * 100)}%`);
  else if (signals.titleSimilarity >= 0.5) parts.push(`title partial ~${Math.round(signals.titleSimilarity * 100)}%`);
  if (signals.addressSimilarity >= 0.6) parts.push(`address ~${Math.round(signals.addressSimilarity * 100)}%`);
  if (signals.coordsDistanceMeters != null && signals.coordsDistanceMeters < COORDS_MAX_M) {
    parts.push(`coords ${Math.round(signals.coordsDistanceMeters)}m`);
  }
  if (parts.length === 0) parts.push("weak signals");
  return `score=${score.toFixed(2)}: ${parts.join(", ")}`;
}

export function scorePlaceCandidate(
  normalized: NormalizedPlaceImport,
  candidate: PlaceCandidate,
): PlaceMatchCandidate {
  // ── Website domain ───────────────────────────────────────────────────────
  let websiteDomainExact = false;
  if (normalized.websites.length > 0 && candidate.website) {
    const candidateDomain = normalizeWebsiteDomain(candidate.website);
    if (candidateDomain) {
      websiteDomainExact = normalized.websites.some(
        (w) => normalizeWebsiteDomain(w) === candidateDomain,
      );
    }
  }

  // ── Phone ────────────────────────────────────────────────────────────────
  let phoneExact = false;
  if (normalized.phones.length > 0 && candidate.phone) {
    const candidatePhone = normalizePhone(candidate.phone);
    phoneExact = normalized.phones.some(
      (p) => normalizePhone(p) === candidatePhone && candidatePhone.length >= 7,
    );
  }

  // ── Title similarity ─────────────────────────────────────────────────────
  let titleSimilarity = 0;
  if (normalized.title && candidate.title) {
    titleSimilarity = tokenJaccard(
      normalizeTitle(normalized.title),
      normalizeTitle(candidate.title),
    );
  }

  // ── Address similarity ───────────────────────────────────────────────────
  let addressSimilarity = 0;
  const importAddr = normalized.addressText;
  const candidateAddr = candidate.formattedAddr ?? candidate.customAddress;
  if (importAddr && candidateAddr) {
    addressSimilarity = tokenJaccard(
      normalizeAddress(importAddr),
      normalizeAddress(candidateAddr),
    );
  }

  // ── Coords proximity ─────────────────────────────────────────────────────
  let coordsDistanceMeters: number | null = null;
  let coordsProximityScore = 0;
  if (
    normalized.lat != null && normalized.lng != null &&
    candidate.lat != null && candidate.lng != null
  ) {
    coordsDistanceMeters = haversineMeters(
      normalized.lat, normalized.lng,
      candidate.lat, candidate.lng,
    );
    coordsProximityScore = coordsScore(coordsDistanceMeters);
  }

  // ── Total score ──────────────────────────────────────────────────────────
  const score =
    (websiteDomainExact ? W.websiteDomainExact : 0) +
    (phoneExact ? W.phoneExact : 0) +
    titleSimilarity * W.titleSimilarity +
    addressSimilarity * W.addressSimilarity +
    coordsProximityScore * W.coordsProximity;

  const roundedScore = Math.round(score * 10000) / 10000;

  const signals: PlaceMatchSignals = {
    websiteDomainExact,
    phoneExact,
    titleSimilarity: Math.round(titleSimilarity * 10000) / 10000,
    addressSimilarity: Math.round(addressSimilarity * 10000) / 10000,
    coordsDistanceMeters: coordsDistanceMeters != null
      ? Math.round(coordsDistanceMeters)
      : null,
  };

  return {
    entityType: "PLACE",
    entityId: candidate.id,
    entityTitle: candidate.title,
    score: roundedScore,
    reason: buildReason(signals, roundedScore),
    signals,
  };
}
