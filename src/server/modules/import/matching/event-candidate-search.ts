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
import { normalizeTitle, normalizeEventTitle, tokenJaccard } from "../utils/string-normalize";
import { lookupVenuePlace } from "../publish/venue-place-lookup";

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
  /** Начала активных сеансов (ActivitySession); не задано в старых вызовах */
  sessionStarts?: Date[];
};

const CANDIDATE_LIMIT = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Сколько разных дат записи (сеансов) учитываем при поиске по дате */
const MAX_IMPORT_DATES = 8;
/** Порог похожести названия для кандидатов, найденных только по дате */
const DATE_ONLY_TITLE_SIMILARITY = 0.5;

/** Даты начала записи (сеансы + startAt), без повторов по календарному дню UTC. */
export function collectImportDates(normalized: NormalizedEventImport): Date[] {
  const raw = [
    ...(normalized.occurrences ?? []).map((o) => o.startAt),
    normalized.startAt,
  ].filter((d): d is string => Boolean(d));
  const byDay = new Map<string, Date>();
  for (const iso of raw) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) continue;
    const key = date.toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, date);
  }
  return [...byDay.values()].slice(0, MAX_IMPORT_DATES);
}

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
    sessions: {
      where: { withdrawnAt: null },
      select: { startsAt: true },
      orderBy: { startsAt: "asc" },
      take: 60,
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
    sessions: { startsAt: Date }[];
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
      sessionStarts: a.sessions.map((session) => session.startsAt),
    };
  }

  // ── 0. По месту и по дате: сеанс в окне ±1 сутки от любой даты записи ─────
  const importDates = collectImportDates(normalized);
  if (importDates.length > 0) {
    const sessionWindow = {
      OR: importDates.map((d) => ({
        startsAt: { gte: new Date(d.getTime() - DAY_MS), lte: new Date(d.getTime() + DAY_MS) },
      })),
    };
    const activeStatus = { notIn: ["DELETED", "ARCHIVED"] } as { notIn: ("DELETED" | "ARCHIVED")[] };

    const place = await lookupVenuePlace(normalized.venueName, normalized.addressText, null);
    if (place) {
      const byPlace = await prisma.activity.findMany({
        where: { placeId: place.placeId, status: activeStatus, sessions: { some: sessionWindow } },
        select,
        take: CANDIDATE_LIMIT,
      });
      add(byPlace.map(mapActivity));
    }

    if (normalized.title) {
      const importTitle = normalizeEventTitle(normalized.title);
      const byDate = await prisma.activity.findMany({
        where: { status: activeStatus, sessions: { some: sessionWindow } },
        select,
        take: 60,
      });
      add(
        byDate
          .filter((a) => tokenJaccard(importTitle, normalizeEventTitle(a.title)) >= DATE_ONLY_TITLE_SIMILARITY)
          .map(mapActivity),
      );
    }
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

  return rankCandidatesForLimit(candidates, normalized.title);
}

/**
 * Кандидаты приходят из нескольких запросов (место, дата, название). Лимит
 * нельзя применять в порядке поступления: 20 несвязанных событий той же
 * площадки вытеснили бы точное совпадение по названию. Сначала ранжируем по
 * похожести названия (порядок внутри равных сохраняется), потом режем.
 */
export function rankCandidatesForLimit(
  candidates: ActivityCandidate[],
  importTitle: string | undefined,
  limit: number = CANDIDATE_LIMIT,
): ActivityCandidate[] {
  if (!importTitle) return candidates.slice(0, limit);
  const target = normalizeEventTitle(importTitle);
  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      similarity: tokenJaccard(target, normalizeEventTitle(candidate.title)),
    }))
    .sort((a, b) => b.similarity - a.similarity || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}
