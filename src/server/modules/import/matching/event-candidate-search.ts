/**
 * Event Candidate Search
 *
 * Поиск кандидатов среди существующих Activity по сигналам EVENT.
 * Стратегия: narrowing → scoring.
 *
 * Не делает full-table scan.
 * Учитывает риск repeated occurrences: похожее название ≠ дубль.
 */

import prisma from "@/lib/prisma";
import type { NormalizedEventImport } from "../types";
import { normalizeTitle } from "../utils/string-normalize";

/** Минимальный набор полей Activity для scoring */
export type ActivityCandidate = {
  id: string;
  title: string;
  shortDesc: string;
  type: string;
  scheduleMode: string;
  status: string;
  nextOccurrenceAt: Date | null;
  cityId: string | null;
  placeId: string | null;
  /** Venue title из EventVenue (если есть) */
  venueTitle: string | null;
  /** Venue address из EventVenue (если есть) */
  venueAddress: string | null;
};

const CANDIDATE_LIMIT = 20;

/**
 * Найти кандидатов среди существующих Activity.
 *
 * Narrowing порядок:
 * 1. Title prefix match (первые 2 значимых слова) — основной сигнал для EVENT
 * 2. Venue title match — если есть venueName в normalized
 *
 * Для EVENT нет таких сильных уникальных идентификаторов как phone/website у Place,
 * поэтому narrowing более широкий, scoring — более консервативный.
 */
export async function findEventCandidates(
  normalized: NormalizedEventImport,
): Promise<ActivityCandidate[]> {
  const seen = new Set<string>();
  const candidates: ActivityCandidate[] = [];

  const select = {
    id: true,
    title: true,
    shortDesc: true,
    type: true,
    scheduleMode: true,
    status: true,
    nextOccurrenceAt: true,
    cityId: true,
    placeId: true,
    venue: {
      select: {
        title: true,
        addressLine: true,
      },
    },
  } as const;

  function add(activities: typeof candidates) {
    for (const a of activities) {
      if (!seen.has(a.id)) {
        seen.add(a.id);
        candidates.push(a);
      }
    }
  }

  function mapActivity(a: {
    id: string;
    title: string;
    shortDesc: string;
    type: string;
    scheduleMode: string;
    status: string;
    nextOccurrenceAt: Date | null;
    cityId: string | null;
    placeId: string | null;
    venue: { title: string | null; addressLine: string | null } | null;
  }): ActivityCandidate {
    return {
      id: a.id,
      title: a.title,
      shortDesc: a.shortDesc,
      type: a.type,
      scheduleMode: a.scheduleMode,
      status: a.status,
      nextOccurrenceAt: a.nextOccurrenceAt,
      cityId: a.cityId,
      placeId: a.placeId,
      venueTitle: a.venue?.title ?? null,
      venueAddress: a.venue?.addressLine ?? null,
    };
  }

  // ── 1. Title prefix match ────────────────────────────────────────────────
  if (normalized.title) {
    const words = normalizeTitle(normalized.title)
      .split(" ")
      .filter((w) => w.length > 2)
      .slice(0, 2);

    if (words.length > 0) {
      const byTitle = await prisma.activity.findMany({
        where: {
          title: { contains: words[0], mode: "insensitive" },
          status: { notIn: ["DELETED", "ARCHIVED"] },
        },
        select,
        take: CANDIDATE_LIMIT,
      });
      add(byTitle.map(mapActivity));
    }
  }

  // ── 2. Venue title match (если мало кандидатов) ──────────────────────────
  if (candidates.length < 5 && normalized.venueName) {
    const venueWords = normalizeTitle(normalized.venueName)
      .split(" ")
      .filter((w) => w.length > 2)
      .slice(0, 1);

    if (venueWords.length > 0) {
      const byVenue = await prisma.activity.findMany({
        where: {
          venue: {
            title: { contains: venueWords[0], mode: "insensitive" },
          },
          status: { notIn: ["DELETED", "ARCHIVED"] },
        },
        select,
        take: CANDIDATE_LIMIT,
      });
      add(byVenue.map(mapActivity));
    }
  }

  return candidates.slice(0, CANDIDATE_LIMIT);
}
