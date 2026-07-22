import type { WordPressOfferPlaceRelationRow } from "../../adapters/wordpress-db/types";

export const OFFER_PLACE_RELATION_COLLAPSE_POLICY_VERSION = "offer-place-collapse-v1";

export type CollapsedOfferPlaceRelationEvidence = {
  offerPostId: number;
  legacyPlaceId: number;
  relatedPostType: "places";
  relationKey: string;
  relationSide: "parent" | "child";
};

export type OfferPlaceRelationCollapseResult =
  | { status: "MISSING"; sourceRowCount: number }
  | { status: "INVALID"; sourceRowCount: number; reason: string }
  | { status: "AMBIGUOUS"; sourceRowCount: number; legacyPlaceIds: readonly number[] }
  | {
      status: "RESOLVED";
      effectiveLegacyPlaceId: number;
      normalizedRelationEvidence: readonly CollapsedOfferPlaceRelationEvidence[];
      uniqueRelationKeys: readonly string[];
      sourceRowCount: number;
      deduplicatedRowCount: number;
      confidence: "EXACT";
    };

const evidenceKey = (row: CollapsedOfferPlaceRelationEvidence): string =>
  [row.offerPostId, row.legacyPlaceId, row.relatedPostType, row.relationKey, row.relationSide].join("|");

export function collapseOfferPlaceRelations(input: {
  offerPostId: number;
  relations: readonly WordPressOfferPlaceRelationRow[];
}): OfferPlaceRelationCollapseResult {
  const sourceRowCount = input.relations.length;
  if (sourceRowCount === 0) return { status: "MISSING", sourceRowCount };
  if (!Number.isSafeInteger(input.offerPostId) || input.offerPostId <= 0) {
    return { status: "INVALID", sourceRowCount, reason: "Offer post ID must be a positive integer." };
  }

  const normalized: CollapsedOfferPlaceRelationEvidence[] = [];
  for (const row of input.relations) {
    if (
      row.post_id !== input.offerPostId ||
      !Number.isSafeInteger(row.related_post_id) || row.related_post_id <= 0 ||
      row.related_post_type !== "places" ||
      (row.relation_side !== "parent" && row.relation_side !== "child") ||
      typeof row.relation_key !== "string" || row.relation_key.trim() === ""
    ) {
      return { status: "INVALID", sourceRowCount, reason: "Relation row is malformed or does not belong to the current Offer." };
    }
    normalized.push({
      offerPostId: input.offerPostId,
      legacyPlaceId: row.related_post_id,
      relatedPostType: "places",
      relationKey: row.relation_key.trim(),
      relationSide: row.relation_side,
    });
  }

  const evidence = [...new Map(normalized.map((row) => [evidenceKey(row), row])).values()]
    .sort((a, b) => evidenceKey(a).localeCompare(evidenceKey(b)));
  const legacyPlaceIds = [...new Set(evidence.map((row) => row.legacyPlaceId))].sort((a, b) => a - b);
  if (legacyPlaceIds.length > 1) return { status: "AMBIGUOUS", sourceRowCount, legacyPlaceIds };
  if (legacyPlaceIds.length === 0) return { status: "MISSING", sourceRowCount };
  return {
    status: "RESOLVED",
    effectiveLegacyPlaceId: legacyPlaceIds[0],
    normalizedRelationEvidence: evidence,
    uniqueRelationKeys: [...new Set(evidence.map((row) => row.relationKey))].sort(),
    sourceRowCount,
    deduplicatedRowCount: evidence.length,
    confidence: "EXACT",
  };
}
