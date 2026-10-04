import type { Prisma, PrismaClient } from "@prisma/client";
import type { PlanOwner } from "@/server/services/planOwner";
import { isStopWord, normalizeText, tokenize } from "./captureText";

/**
 * Backend shortlist of Place candidates (up to 5) for the LLM to choose from.
 * No LLM involved: exact normalized title (whole phrase present in the text)
 * ranks above token overlap. Only public, published, non-archived places in
 * the owner's city are considered.
 */
export const PLACE_SHORTLIST_LIMIT = 5;
const MAX_PLACES_SCANNED = 5000;
const MIN_FUZZY_OVERLAP = 2;
const MIN_FUZZY_RATIO = 0.6;
const MIN_TITLE_CHARS = 3;

export type PlaceCandidate = { id: string; title: string; address: string; exact: boolean };

type PlaceRow = {
  id: string;
  title: string;
  shortAddress: string | null;
  formattedAddr: string | null;
  customAddress: string | null;
};

export type PlaceCandidateDeps = {
  db: Pick<PrismaClient, "place">;
  /** Public-visibility filter; the default is the platform-wide `getPublicPublishedPlaceWhere()`. */
  publicPlaceWhere: Prisma.PlaceWhereInput;
};

function addressOf(row: PlaceRow): string {
  return row.shortAddress ?? row.formattedAddr ?? row.customAddress ?? "";
}

/** Pure ranking step: `rows` are the candidate places, `text` the user's message text. */
export function rankPlaceCandidates(rows: PlaceRow[], text: string, limit = PLACE_SHORTLIST_LIMIT): PlaceCandidate[] {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return [];
  const padded = ` ${normalizedText} `;
  const textTokens = new Set(tokenize(text));

  const scored: Array<{ candidate: PlaceCandidate; score: number }> = [];
  for (const row of rows) {
    const normalizedTitle = normalizeText(row.title);
    if (normalizedTitle.length < MIN_TITLE_CHARS) continue;
    const titleTokens = tokenize(row.title).filter((token) => !isStopWord(token));
    if (titleTokens.length === 0) continue;

    if (padded.includes(` ${normalizedTitle} `)) {
      scored.push({
        candidate: { id: row.id, title: row.title, address: addressOf(row), exact: true },
        score: 1000 + normalizedTitle.length,
      });
      continue;
    }

    const overlap = titleTokens.filter((token) => textTokens.has(token)).length;
    const ratio = overlap / titleTokens.length;
    if (overlap >= MIN_FUZZY_OVERLAP && ratio >= MIN_FUZZY_RATIO) {
      scored.push({
        candidate: { id: row.id, title: row.title, address: addressOf(row), exact: false },
        score: 100 * ratio + overlap,
      });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.candidate.title.length - b.candidate.title.length)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

export async function resolvePlaceCandidates(
  deps: PlaceCandidateDeps,
  _owner: PlanOwner,
  cityId: string | null,
  inputText: string,
  limit = PLACE_SHORTLIST_LIMIT,
): Promise<PlaceCandidate[]> {
  if (!cityId || !normalizeText(inputText)) return [];
  const rows = await deps.db.place.findMany({
    where: { AND: [deps.publicPlaceWhere, { cityId }] },
    select: { id: true, title: true, shortAddress: true, formattedAddr: true, customAddress: true },
    take: MAX_PLACES_SCANNED,
  });
  return rankPlaceCandidates(rows, inputText, limit);
}
