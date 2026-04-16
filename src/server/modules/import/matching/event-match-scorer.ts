/**
 * Event Match Scorer
 *
 * Считает score для пары (NormalizedEventImport, ActivityCandidate).
 *
 * Ключевое отличие от PLACE scoring:
 * - Нет phone/website как сильных идентификаторов
 * - Дата начала — важный сигнал, но НЕ является proof of duplicate:
 *   same title + same venue + different date = возможный occurrence, не дубль
 * - possibleOccurrenceRisk флаг предупреждает ревьюера
 */

import type { NormalizedEventImport, EventMatchCandidate, EventMatchSignals } from "../types";
import type { ActivityCandidate } from "./event-candidate-search";
import { normalizeTitle, normalizeAddress, tokenJaccard } from "../utils/string-normalize";

// ── Веса компонентов (сумма = 1.0) ───────────────────────────────────────────
const W = {
  titleSimilarity:     0.40,
  venueSimilarity:     0.25,
  addressSimilarity:   0.10,
  organizerSimilarity: 0.10,
  startDateProximity:  0.15,
} as const;

/** Дней — точное совпадение даты */
const DATE_EXACT_DAYS = 0;
/** Дней — полный score proximity */
const DATE_CLOSE_DAYS = 3;
/** Дней — score = 0 */
const DATE_FAR_DAYS = 60;

/**
 * Нормализовать название организатора для сравнения.
 */
function normalizeOrganizer(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[«»""'']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Вычислить разницу в днях между двумя ISO-строками дат.
 * Возвращает null если хотя бы одна дата не парсится.
 */
function dateDeltaDays(a: string, b: string | Date): number | null {
  const da = new Date(a);
  const db = b instanceof Date ? b : new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
  return Math.abs(da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Score близости дат [0..1].
 * 0 дней → 1.0, DATE_CLOSE_DAYS → 1.0, DATE_FAR_DAYS → 0.0.
 */
function dateProximityScore(deltaDays: number): number {
  if (deltaDays <= DATE_CLOSE_DAYS) return 1;
  if (deltaDays >= DATE_FAR_DAYS) return 0;
  return 1 - (deltaDays - DATE_CLOSE_DAYS) / (DATE_FAR_DAYS - DATE_CLOSE_DAYS);
}

function buildReason(signals: EventMatchSignals, score: number): string {
  const parts: string[] = [];
  if (signals.titleSimilarity >= 0.8) parts.push(`title ~${Math.round(signals.titleSimilarity * 100)}%`);
  else if (signals.titleSimilarity >= 0.5) parts.push(`title partial ~${Math.round(signals.titleSimilarity * 100)}%`);
  if (signals.venueSimilarity >= 0.6) parts.push(`venue ~${Math.round(signals.venueSimilarity * 100)}%`);
  if (signals.addressSimilarity >= 0.5) parts.push(`address ~${Math.round(signals.addressSimilarity * 100)}%`);
  if (signals.organizerSimilarity >= 0.6) parts.push(`organizer ~${Math.round(signals.organizerSimilarity * 100)}%`);
  if (signals.startDateDeltaDays != null) {
    if (signals.startDateDeltaDays <= DATE_CLOSE_DAYS) parts.push(`date match (Δ${signals.startDateDeltaDays.toFixed(1)}d)`);
    else parts.push(`date Δ${signals.startDateDeltaDays.toFixed(0)}d`);
  }
  if (signals.possibleOccurrenceRisk) parts.push("⚠ occurrence risk");
  if (parts.length === 0) parts.push("weak signals");
  return `score=${score.toFixed(2)}: ${parts.join(", ")}`;
}

export function scoreEventCandidate(
  normalized: NormalizedEventImport,
  candidate: ActivityCandidate,
): EventMatchCandidate {
  // ── Title similarity ─────────────────────────────────────────────────────
  const titleSimilarity = normalized.title && candidate.title
    ? tokenJaccard(normalizeTitle(normalized.title), normalizeTitle(candidate.title))
    : 0;

  // ── Venue similarity ─────────────────────────────────────────────────────
  let venueSimilarity = 0;
  if (normalized.venueName && candidate.venueTitle) {
    venueSimilarity = tokenJaccard(
      normalizeTitle(normalized.venueName),
      normalizeTitle(candidate.venueTitle),
    );
  }

  // ── Address similarity ───────────────────────────────────────────────────
  let addressSimilarity = 0;
  const importAddr = normalized.addressText;
  const candidateAddr = candidate.venueAddress;
  if (importAddr && candidateAddr) {
    addressSimilarity = tokenJaccard(
      normalizeAddress(importAddr),
      normalizeAddress(candidateAddr),
    );
  }

  // ── Organizer similarity ─────────────────────────────────────────────────
  // Activity не имеет поля organizer — используем shortDesc как прокси
  let organizerSimilarity = 0;
  if (normalized.organizerName && candidate.shortDesc) {
    organizerSimilarity = tokenJaccard(
      normalizeOrganizer(normalized.organizerName),
      normalizeOrganizer(candidate.shortDesc),
    );
  }

  // ── Start date proximity ─────────────────────────────────────────────────
  let startDateDeltaDays: number | null = null;
  let dateScore = 0;
  if (normalized.startAt && candidate.nextOccurrenceAt) {
    startDateDeltaDays = dateDeltaDays(normalized.startAt, candidate.nextOccurrenceAt);
    if (startDateDeltaDays != null) {
      dateScore = dateProximityScore(startDateDeltaDays);
    }
  }

  // ── Occurrence risk detection ────────────────────────────────────────────
  // Риск: title похож + venue похож + дата РАЗНАЯ (> DATE_CLOSE_DAYS)
  const titleVenueMatch = titleSimilarity >= 0.7 && venueSimilarity >= 0.6;
  const dateDiffers = startDateDeltaDays != null && startDateDeltaDays > DATE_CLOSE_DAYS;
  const possibleOccurrenceRisk = titleVenueMatch && dateDiffers;

  // ── Total score ──────────────────────────────────────────────────────────
  const score =
    titleSimilarity     * W.titleSimilarity +
    venueSimilarity     * W.venueSimilarity +
    addressSimilarity   * W.addressSimilarity +
    organizerSimilarity * W.organizerSimilarity +
    dateScore           * W.startDateProximity;

  const roundedScore = Math.round(score * 10000) / 10000;

  const signals: EventMatchSignals = {
    titleSimilarity:     Math.round(titleSimilarity * 10000) / 10000,
    venueSimilarity:     Math.round(venueSimilarity * 10000) / 10000,
    addressSimilarity:   Math.round(addressSimilarity * 10000) / 10000,
    organizerSimilarity: Math.round(organizerSimilarity * 10000) / 10000,
    startDateDeltaDays:  startDateDeltaDays != null ? Math.round(startDateDeltaDays * 10) / 10 : null,
    possibleOccurrenceRisk,
  };

  return {
    entityType: "ACTIVITY",
    entityId: candidate.id,
    entityTitle: candidate.title,
    score: roundedScore,
    reason: buildReason(signals, roundedScore),
    signals,
  };
}
