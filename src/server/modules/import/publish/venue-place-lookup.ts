/**
 * Venue Place Lookup
 *
 * Поиск существующего Place по venueName/addressText из NormalizedEventImport.
 * Используется при publish EVENT — для автоматической привязки Activity.placeId.
 *
 * Не создаёт новые Place. Не бросает ошибки — возвращает null если не найдено.
 */

import prisma from "@/lib/prisma";
import { tokenJaccard } from "../utils/string-normalize";

export interface VenuePlaceMatch {
  placeId: string;
  placeTitle: string;
  score: number;
  reason: string;
}

const MIN_VENUE_SCORE = 0.55;

/**
 * Найти Place по venueName (и опционально addressText).
 * Возвращает лучший кандидат или null.
 */
export async function lookupVenuePlace(
  venueName: string | undefined,
  addressText: string | undefined,
  cityId: string | null,
): Promise<VenuePlaceMatch | null> {
  if (!venueName?.trim() && !addressText?.trim()) return null;

  const searchTerm = venueName?.trim() ?? addressText?.trim() ?? "";
  if (!searchTerm) return null;

  // Берём первое значимое слово для narrowing
  const firstWord = searchTerm
    .toLowerCase()
    .split(/\s+/)
    .find((w) => w.length > 2);

  if (!firstWord) return null;

  const candidates = await prisma.place.findMany({
    where: {
      title: { contains: firstWord, mode: "insensitive" },
      status: { notIn: ["DELETED", "ARCHIVED"] },
      ...(cityId ? { cityId } : {}),
    },
    select: { id: true, title: true, formattedAddr: true, customAddress: true },
    take: 10,
  });

  if (candidates.length === 0) return null;

  const normalizedSearch = searchTerm.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();

  let best: VenuePlaceMatch | null = null;

  for (const c of candidates) {
    const normalizedTitle = c.title.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
    const titleScore = tokenJaccard(normalizedSearch, normalizedTitle);

    let addrScore = 0;
    if (addressText && (c.formattedAddr || c.customAddress)) {
      const addr = (c.formattedAddr ?? c.customAddress ?? "").toLowerCase();
      addrScore = tokenJaccard(
        addressText.toLowerCase().replace(/[^\w\s]/g, " ").trim(),
        addr.replace(/[^\w\s]/g, " ").trim(),
      );
    }

    const score = Math.max(titleScore, addrScore * 0.8);

    if (score >= MIN_VENUE_SCORE && (!best || score > best.score)) {
      best = {
        placeId: c.id,
        placeTitle: c.title,
        score,
        reason: titleScore >= addrScore
          ? `title match ~${(titleScore * 100).toFixed(0)}%`
          : `address match ~${(addrScore * 100).toFixed(0)}%`,
      };
    }
  }

  return best;
}
