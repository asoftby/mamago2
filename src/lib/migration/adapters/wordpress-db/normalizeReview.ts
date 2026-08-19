import { createHash } from "node:crypto";

import type { MigrationWarning, NormalizedRecord } from "../../types";
import type { WordPressVoxelReviewRow } from "./types";

export type { WordPressVoxelReviewRow };

export const REVIEW_SOURCE_ENTITY_TYPE = "wordpress-db:voxel-timeline-review";
export const REVIEW_SOURCE_REVIEW_ID_PREFIX = "wp-voxel-timeline:";

export interface NormalizedReviewCandidate {
  sourceRecordKey: `wordpress-db:voxel-timeline-review:${number}`;
  legacyReviewId: number;
  legacyUserId: number;
  legacyPlaceId: number;
  userSourceRecordKey: `wordpress-db:user:${number}`;
  placeSourceRecordKey: `wordpress-db:places:${number}`;
  sourceReviewId: string;
  body: string | null;
  rawScore: number | null;
  rating: number | null;
  publishedAt: string;
  moderation: string | null;
  publishedAs: string | null;
  placeStatus: string | null;
}

/**
 * Voxel `review_score` is a decimal in approximately [-2, +2].
 * Map to mamaGo's 1–5 integer: round(score + 3), clamped.
 * -2 → 1, 0 → 3, +2 → 5.
 */
export function mapVoxelReviewScoreToRating(score: number): number {
  return Math.min(5, Math.max(1, Math.round(score + 3)));
}

export function buildReviewSourceRecordKey(id: number): `wordpress-db:voxel-timeline-review:${number}` {
  return `wordpress-db:voxel-timeline-review:${id}`;
}

export function buildReviewSourceReviewId(id: number): string {
  return `${REVIEW_SOURCE_REVIEW_ID_PREFIX}${id}`;
}

function parseScore(raw: string | number | null): number | null {
  if (raw === null || raw === undefined) return null;
  const value = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(value)) return null;
  return value;
}

export function hashReviewCandidate(candidate: NormalizedReviewCandidate): string {
  const material = {
    id: candidate.legacyReviewId,
    userId: candidate.legacyUserId,
    placeId: candidate.legacyPlaceId,
    body: candidate.body,
    rawScore: candidate.rawScore,
    rating: candidate.rating,
    publishedAt: candidate.publishedAt,
    moderation: candidate.moderation,
  };
  return `review-v1:${createHash("sha256").update(JSON.stringify(material)).digest("hex")}`;
}

export function normalizeVoxelReview(row: WordPressVoxelReviewRow): NormalizedRecord {
  const sourceRecordKey = buildReviewSourceRecordKey(row.id);
  const warnings: MigrationWarning[] = [];
  const rawScore = parseScore(row.review_score);
  const rating = rawScore === null ? null : mapVoxelReviewScoreToRating(rawScore);
  if (rawScore === null) {
    warnings.push({
      code: "REVIEW_SCORE_MISSING",
      message: "Voxel review_score is missing or not numeric; this review cannot be imported.",
      severity: "WARNING",
      sourceRecordKey,
    });
  }
  if (row.place_status && row.place_status !== "publish") {
    warnings.push({
      code: "REVIEW_PLACE_NOT_PUBLISHED",
      message: "Legacy Place for this review is not published.",
      severity: "WARNING",
      sourceRecordKey,
      details: { placeStatus: row.place_status, legacyPlaceId: row.post_id },
    });
  }

  const candidate: NormalizedReviewCandidate = {
    sourceRecordKey,
    legacyReviewId: row.id,
    legacyUserId: row.user_id,
    legacyPlaceId: row.post_id,
    userSourceRecordKey: `wordpress-db:user:${row.user_id}`,
    placeSourceRecordKey: `wordpress-db:places:${row.post_id}`,
    sourceReviewId: buildReviewSourceReviewId(row.id),
    body: row.content?.trim() || null,
    rawScore,
    rating,
    publishedAt: row.created_at,
    moderation: row.moderation,
    publishedAs: row.published_as,
    placeStatus: row.place_status,
  };

  return {
    sourceRecordKey,
    sourceEntityType: REVIEW_SOURCE_ENTITY_TYPE,
    targetTypeHint: "PLACE_REVIEW",
    normalizedPayload: candidate,
    mediaRefs: [],
    relationRefs: [candidate.userSourceRecordKey, candidate.placeSourceRecordKey],
    warnings,
  };
}

export const normalizeReview = normalizeVoxelReview;
