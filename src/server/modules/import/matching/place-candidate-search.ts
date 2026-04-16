/**
 * Place Candidate Search
 *
 * Грубый поиск кандидатов среди существующих Place по сигналам.
 * Стратегия: сначала narrowing (дешёвые фильтры), потом scoring.
 *
 * Не делает full-table scan — использует индексированные поля.
 */

import prisma from "@/lib/prisma";
import type { NormalizedPlaceImport } from "../types";
import { normalizePhone, normalizeWebsiteDomain } from "../utils/string-normalize";

/** Минимальный набор полей Place для scoring */
export type PlaceCandidate = {
  id: string;
  title: string;
  phone: string | null;
  website: string | null;
  formattedAddr: string | null;
  customAddress: string | null;
  lat: number | null;
  lng: number | null;
  cityId: string | null;
  status: string;
};

const CANDIDATE_LIMIT = 20;

/**
 * Найти кандидатов среди существующих Place.
 *
 * Порядок narrowing:
 * 1. Точное совпадение домена сайта (самый сильный сигнал)
 * 2. Точное совпадение нормализованного телефона
 * 3. Поиск по первому слову title (LIKE) — только если нет совпадений выше
 *
 * Возвращает дедуплицированный список кандидатов.
 */
export async function findPlaceCandidates(
  normalized: NormalizedPlaceImport,
): Promise<PlaceCandidate[]> {
  const seen = new Set<string>();
  const candidates: PlaceCandidate[] = [];

  function add(places: PlaceCandidate[]) {
    for (const p of places) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        candidates.push(p);
      }
    }
  }

  const select = {
    id: true,
    title: true,
    phone: true,
    website: true,
    formattedAddr: true,
    customAddress: true,
    lat: true,
    lng: true,
    cityId: true,
    status: true,
  } as const;

  // ── 1. Website domain match ──────────────────────────────────────────────
  for (const website of normalized.websites) {
    const domain = normalizeWebsiteDomain(website);
    if (!domain) continue;

    // Ищем Place с website содержащим этот домен
    const byWebsite = await prisma.place.findMany({
      where: {
        website: { contains: domain, mode: "insensitive" },
        archivedAt: null,
      },
      select,
      take: CANDIDATE_LIMIT,
    });
    add(byWebsite);
  }

  // ── 2. Phone match ───────────────────────────────────────────────────────
  for (const phone of normalized.phones) {
    const norm = normalizePhone(phone);
    if (norm.length < 7) continue;

    const byPhone = await prisma.place.findMany({
      where: {
        phone: { contains: norm.slice(-7) }, // последние 7 цифр
        archivedAt: null,
      },
      select,
      take: CANDIDATE_LIMIT,
    });
    add(byPhone);
  }

  // ── 3. Title prefix match (только если мало кандидатов) ─────────────────
  if (candidates.length < 3 && normalized.title) {
    // Берём первые два значимых слова из title
    const words = normalized.title
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 2);

    if (words.length > 0) {
      const byTitle = await prisma.place.findMany({
        where: {
          title: { contains: words[0], mode: "insensitive" },
          archivedAt: null,
        },
        select,
        take: CANDIDATE_LIMIT,
      });
      add(byTitle);
    }
  }

  return candidates.slice(0, CANDIDATE_LIMIT);
}
