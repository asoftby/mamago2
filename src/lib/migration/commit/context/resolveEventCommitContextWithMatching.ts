import type { PrismaClient } from "@prisma/client";

import type { MigrationWarning } from "../../types";
import type { NormalizedEventCandidate } from "../event/types";
import type { EventCommitContext } from "../event/types";

export interface EventContextMatchingPrismaClient {
  city: Pick<PrismaClient["city"], "findMany" | "findFirst">;
  eventCategory: Pick<PrismaClient["eventCategory"], "findMany">;
  place: Pick<PrismaClient["place"], "findMany">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findFirst">;
}

export interface ResolveEventCommitContextWithMatchingInput {
  sourceRecordKey: string;
  baseContext: EventCommitContext;
  candidate: NormalizedEventCandidate;
  prisma: EventContextMatchingPrismaClient;
}

export interface ResolveEventCommitContextWithMatchingResult {
  context: EventCommitContext;
  warnings: MigrationWarning[];
}

function normText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeMinsk(value: string): boolean {
  const t = normText(value);
  return t === "минск" || t.includes("минск");
}

function warning(
  sourceRecordKey: string,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): MigrationWarning {
  return { code, message, severity: "WARNING", sourceRecordKey, ...(details ? { details } : {}) };
}

export async function resolveEventCommitContextWithMatching(
  input: ResolveEventCommitContextWithMatchingInput,
): Promise<ResolveEventCommitContextWithMatchingResult> {
  const { sourceRecordKey, baseContext, candidate, prisma } = input;
  const warnings: MigrationWarning[] = [];
  const ctx: EventCommitContext = { ...baseContext };

  // ---------------------------------------------------------------------------
  // City matching (minimal): explicit context wins; otherwise try Minsk from raw.
  // ---------------------------------------------------------------------------
  if (!ctx.cityId) {
    const rawCity = candidate.cityRaw ?? "";
    if (rawCity && looksLikeMinsk(rawCity)) {
      const minsk = await prisma.city.findFirst({ where: { slug: "minsk" }, select: { id: true } });
      if (minsk?.id) {
        ctx.cityId = minsk.id;
        warnings.push(
          warning(sourceRecordKey, "EVENT_CITY_FALLBACK_USED", 'Matched city by raw hint ("Минск") → slug "minsk".', {
            cityRaw: rawCity,
          }),
        );
      } else {
        warnings.push(
          warning(sourceRecordKey, "EVENT_CITY_UNMATCHED", 'Raw city looks like Minsk but city slug "minsk" was not found.', {
            cityRaw: rawCity,
          }),
        );
      }
    } else if (rawCity) {
      warnings.push(
        warning(sourceRecordKey, "EVENT_CITY_UNMATCHED", "City is present in source but no automatic matcher is implemented yet (only Minsk).", {
          cityRaw: rawCity,
        }),
      );
    } else {
      warnings.push(warning(sourceRecordKey, "EVENT_CITY_UNMATCHED", "No city hint present in source (cityRaw is null)."));
    }
  }

  // ---------------------------------------------------------------------------
  // Category matching (minimal): match existing EventCategory by nameRu keywords.
  // ---------------------------------------------------------------------------
  if (!ctx.eventCategoryId) {
    const terms = candidate.sourceTerms?.filter((t) => t.taxonomy === "events-category") ?? [];
    const termNames = terms.map((t) => t.normalizedName ?? normText(t.name ?? "")).filter(Boolean);
    if (termNames.length === 0) {
      warnings.push(warning(sourceRecordKey, "EVENT_CATEGORY_UNMATCHED", "No events-category terms present on source event.", {
        taxonomies: (candidate.sourceTerms ?? []).map((t) => t.taxonomy),
      }));
    } else {
      const categories = await prisma.eventCategory.findMany({ select: { id: true, nameRu: true } });
      const normalizedCategories = categories.map((c) => ({ id: c.id, name: c.nameRu, norm: normText(c.nameRu) }));

      const synonyms: Array<{ needle: string; needles: string[] }> = [
        { needle: "мастер класс", needles: ["мастер класс", "мастеркласс", "workshop", "masterclass"] },
        { needle: "спектакль", needles: ["спектакль", "театр", "theatre", "performance"] },
        { needle: "кино", needles: ["кино", "cinema"] },
        { needle: "музей", needles: ["музей", "выставка", "culture"] },
        { needle: "развлекательный центр", needles: ["развлекательный центр", "entertainment"] },
        { needle: "кафе", needles: ["кафе", "food", "cafe"] },
      ];

      function matchCategoryId(): { id: string | null; confidence: "MATCHED_HIGH" | "MATCHED_LOW" | "UNMATCHED"; matchedBy?: string } {
        for (const term of termNames) {
          // Exact normalized match
          const exact = normalizedCategories.find((c) => c.norm === term);
          if (exact) return { id: exact.id, confidence: "MATCHED_HIGH", matchedBy: `exact:${term}` };

          // Synonym keyword match
          for (const syn of synonyms) {
            if (syn.needles.some((n) => term.includes(n))) {
              const hits = normalizedCategories.filter((c) => c.norm.includes(syn.needle));
              if (hits.length === 1) return { id: hits[0]!.id, confidence: "MATCHED_HIGH", matchedBy: `synonym:${syn.needle}` };
              if (hits.length > 1) return { id: hits[0]!.id, confidence: "MATCHED_LOW", matchedBy: `synonym-ambiguous:${syn.needle}` };
            }
          }
        }
        return { id: null, confidence: "UNMATCHED" };
      }

      const match = matchCategoryId();
      if (match.id && match.confidence === "MATCHED_HIGH") {
        ctx.eventCategoryId = match.id;
      } else if (match.id && match.confidence === "MATCHED_LOW") {
        warnings.push(
          warning(sourceRecordKey, "EVENT_CATEGORY_LOW_CONFIDENCE", "Category matched with low confidence; leaving eventCategoryId null for review.", {
            termNames,
            matchedBy: match.matchedBy,
          }),
        );
      } else {
        warnings.push(
          warning(sourceRecordKey, "EVENT_CATEGORY_UNMATCHED", "Could not match source taxonomy to an existing EventCategory.", {
            termNames,
          }),
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Place matching (minimal): lineage if we have a WP place ref, else title/address heuristics.
  // ---------------------------------------------------------------------------
  if (!ctx.placeId) {
    const placePostId = candidate.venuePlacePostIdRaw ?? null;
    if (placePostId) {
      const placeSourceKey = `wordpress-db:places:${placePostId}`;
      const lineage = await prisma.migrationLineage.findFirst({
        where: { sourceRecordKey: placeSourceKey, targetType: "PLACE", isActive: true },
        select: { targetId: true },
      });
      if (lineage?.targetId) {
        ctx.placeId = lineage.targetId;
      } else {
        warnings.push(
          warning(sourceRecordKey, "EVENT_PLACE_UNMATCHED", "WP place reference exists but no active PLACE lineage was found.", {
            placeSourceKey,
          }),
        );
      }
    } else {
      const rawVenue = candidate.venueNameRaw ?? "";
      const rawAddr = candidate.addressEventPlaceRaw ?? candidate.locationRaw ?? "";
      const cityId = ctx.cityId ?? null;

      if (!rawVenue && !rawAddr) {
        warnings.push(warning(sourceRecordKey, "EVENT_PLACE_UNMATCHED", "No venue/address hints present in source to match a Place."));
      } else {
        const venueNorm = normText(rawVenue);
        const addrNorm = normText(rawAddr);

        const candidates = await prisma.place.findMany({
          where: {
            ...(cityId ? { cityId } : {}),
            OR: [
              rawVenue ? { title: { contains: rawVenue, mode: "insensitive" } } : undefined,
              rawAddr ? { formattedAddr: { contains: rawAddr, mode: "insensitive" } } : undefined,
              rawAddr ? { customAddress: { contains: rawAddr, mode: "insensitive" } } : undefined,
            ].filter(Boolean) as any,
          },
          select: { id: true, title: true, formattedAddr: true, customAddress: true, cityId: true },
          take: 10,
        });

        const scored = candidates
          .map((p) => {
            const titleNorm = normText(p.title);
            const addrCandidate = normText(p.customAddress ?? p.formattedAddr ?? "");
            let score = 0;
            if (venueNorm && titleNorm === venueNorm) score += 0.7;
            else if (venueNorm && titleNorm.includes(venueNorm)) score += 0.4;
            if (addrNorm && addrCandidate && addrCandidate.includes(addrNorm)) score += 0.3;
            if (cityId && p.cityId === cityId) score += 0.1;
            return { id: p.id, score };
          })
          .sort((a, b) => b.score - a.score);

        const best = scored[0];
        if (best && best.score >= 0.9) {
          ctx.placeId = best.id;
        } else if (best && best.score >= 0.6) {
          warnings.push(
            warning(sourceRecordKey, "EVENT_PLACE_LOW_CONFIDENCE", "Place matched with low confidence; leaving placeId null for review.", {
              bestScore: best.score,
              venueNameRaw: candidate.venueNameRaw,
              addressRaw: candidate.addressEventPlaceRaw ?? candidate.locationRaw,
            }),
          );
        } else {
          warnings.push(
            warning(sourceRecordKey, "EVENT_PLACE_UNMATCHED", "Could not match venue/address to an existing Place.", {
              venueNameRaw: candidate.venueNameRaw,
              addressRaw: candidate.addressEventPlaceRaw ?? candidate.locationRaw,
            }),
          );
        }

        if (!ctx.placeId) {
          warnings.push(
            warning(sourceRecordKey, "EVENT_RAW_LOCATION_PRESERVED", "Raw location evidence preserved for manual review.", {
              venueNameRaw: candidate.venueNameRaw,
              locationRaw: candidate.locationRaw,
              addressEventPlaceRaw: candidate.addressEventPlaceRaw,
            }),
          );
        }
      }
    }
  }

  return { context: ctx, warnings };
}

