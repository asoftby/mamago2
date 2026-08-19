import assert from "node:assert/strict";

import { mapVoxelReviewScoreToRating, normalizeVoxelReview, hashReviewCandidate } from "../../adapters/wordpress-db/normalizeReview";
import type { WordPressVoxelReviewRow } from "../../adapters/wordpress-db/normalizeReview";
import { ReviewCommitRunner } from "./ReviewCommitRunner";
import type { NormalizedReviewCandidate } from "../../adapters/wordpress-db/normalizeReview";
import type { MigrationRecord } from "@prisma/client";

assert.equal(mapVoxelReviewScoreToRating(-2), 1);
assert.equal(mapVoxelReviewScoreToRating(0), 3);
assert.equal(mapVoxelReviewScoreToRating(2), 5);
assert.equal(mapVoxelReviewScoreToRating(-0.67), 2);
assert.equal(mapVoxelReviewScoreToRating(1.67), 5);

function row(overrides: Partial<WordPressVoxelReviewRow> = {}): WordPressVoxelReviewRow {
  return {
    id: 10,
    user_id: 38,
    post_id: 5389,
    feed: "post_reviews",
    content: "Great place",
    details: null,
    review_score: "2.00",
    created_at: "2024-05-01 12:00:00",
    moderation: null,
    published_as: null,
    place_status: "publish",
    ...overrides,
  };
}

const normalized = normalizeVoxelReview(row());
const candidate = normalized.normalizedPayload as NormalizedReviewCandidate;
const sourceHash = hashReviewCandidate(candidate);
assert.equal(candidate.rating, 5);
assert.equal(candidate.sourceReviewId, "wp-voxel-timeline:10");
assert.equal(candidate.userSourceRecordKey, "wordpress-db:user:38");
assert.equal(candidate.placeSourceRecordKey, "wordpress-db:places:5389");
assert.ok(sourceHash.startsWith("review-v1:"));

function record(overrides: Partial<MigrationRecord> = {}): MigrationRecord {
  return {
    id: "rec-1",
    sourceId: "src-1",
    runId: "run-1",
    sourceRecordKey: candidate.sourceRecordKey,
    sourceEntityType: "wordpress-db:voxel-timeline-review",
    sourceStableKey: candidate.sourceRecordKey,
    sourceHash: sourceHash,
    status: "PLANNED",
  } as MigrationRecord;
}

function operation(action: "CREATE" | "UPDATE" = "CREATE") {
  return {
    recordId: "rec-1",
    sourceRecordKey: candidate.sourceRecordKey,
    targetType: "PLACE_REVIEW" as const,
    action,
    order: 0,
    dependsOn: [] as string[],
    rollbackSteps: [] as never[],
  };
}

type LineageRow = {
  id: string;
  targetId: string;
  lastSourceHash: string;
  lastImportedAt: Date | null;
  sourceRecordKey: string;
  targetType: "USER" | "PLACE" | "PLACE_REVIEW";
};

async function runCase(options: {
  user?: LineageRow | null;
  place?: LineageRow | null;
  reviewLineage?: LineageRow | null;
  existingReview?: { id: string; updatedAt: Date; rating: number } | null;
  candidateOverrides?: Partial<NormalizedReviewCandidate>;
  action?: "CREATE" | "UPDATE";
}) {
  const reviews: Array<Record<string, unknown>> = [];
  const recordUpdates: Array<unknown> = [];
  const users = new Map([["user-1", { id: "user-1", displayName: "Anna", email: "a@example.com" }]]);
  const lineageByType = new Map<string, LineageRow | null>([
    ["USER", options.user === undefined ? { id: "ul", targetId: "user-1", lastSourceHash: "u", lastImportedAt: new Date(), sourceRecordKey: candidate.userSourceRecordKey, targetType: "USER" } : options.user],
    ["PLACE", options.place === undefined ? { id: "pl", targetId: "place-1", lastSourceHash: "p", lastImportedAt: new Date(), sourceRecordKey: candidate.placeSourceRecordKey, targetType: "PLACE" } : options.place],
    ["PLACE_REVIEW", options.reviewLineage ?? null],
  ]);

  const runner = new ReviewCommitRunner({
    prisma: {
      migrationRecord: {
        update: async (args: unknown) => {
          recordUpdates.push(args);
          return {};
        },
      } as never,
      migrationLineage: {
        findFirst: async () => null,
        update: async () => ({}),
      } as never,
      placeReview: {
        findUnique: async (args: { where: { id?: string; placeId_source_sourceReviewId?: unknown } }) => {
          if (args.where.id) return options.existingReview ? { ...options.existingReview, placeId: "place-1" } : null;
          if (args.where.placeId_source_sourceReviewId) {
            if (options.existingReview) return { ...options.existingReview, placeId: "place-1" };
            return reviews[0] ?? null;
          }
          return reviews[0] ?? null;
        },
        create: async (args: { data: Record<string, unknown> }) => {
          const created = { ...args.data, id: "review-1", updatedAt: new Date() };
          reviews.push(created);
          return created;
        },
        update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
          return { id: args.where.id, ...args.data, updatedAt: new Date() };
        },
      } as never,
      user: {
        findUnique: async (args: { where: { id: string } }) => users.get(args.where.id) ?? null,
      } as never,
    },
    lineageLookup: {
      async findActive(input) {
        return lineageByType.get(input.targetType) ?? null;
      },
    },
    lineageWriter: {
      async createLineage() {
        return { lineageId: "lin-review", sourceRecordKey: candidate.sourceRecordKey, targetType: "PLACE_REVIEW", targetId: "review-1" };
      },
    },
  });

  const result = await runner.execute({
    operation: operation(options.action),
    candidate: { ...candidate, ...options.candidateOverrides },
    migrationRecord: record(),
  });
  return { result, reviews, recordUpdates };
}

async function main() {
{
  const { result, reviews } = await runCase({});
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.action, "CREATE");
    assert.equal(result.reviewId, "review-1");
  }
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0]?.sourceReviewId, "wp-voxel-timeline:10");
  assert.equal(reviews[0]?.source, "MAMAGO");
  assert.equal(reviews[0]?.rating, 5);
}

{
  const { result, reviews } = await runCase({
    reviewLineage: {
      id: "rl",
      targetId: "review-1",
      lastSourceHash: sourceHash,
      lastImportedAt: new Date("2026-08-01T00:00:00.000Z"),
      sourceRecordKey: candidate.sourceRecordKey,
      targetType: "PLACE_REVIEW",
    },
    existingReview: { id: "review-1", updatedAt: new Date("2026-08-01T00:00:00.000Z"), rating: 5 },
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.action, "SKIP_UNCHANGED");
  assert.equal(reviews.length, 0);
}

{
  const { result } = await runCase({ user: null });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, "REVIEW_SKIP_MISSING_USER");
    assert.equal(result.action, "SKIP");
  }
}

{
  const { result } = await runCase({ place: null });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errorCode, "REVIEW_SKIP_MISSING_PLACE");
}

{
  const { result } = await runCase({
    candidateOverrides: { rating: null, rawScore: null },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errorCode, "REVIEW_SKIP_INVALID_SCORE");
}

{
  const { result } = await runCase({
    candidateOverrides: { placeStatus: "draft" },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errorCode, "REVIEW_SKIP_UNPUBLISHED_PLACE");
}

{
  const { result, reviews } = await runCase({
    reviewLineage: {
      id: "rl",
      targetId: "review-1",
      lastSourceHash: "old-hash",
      lastImportedAt: new Date("2026-08-01T00:00:00.000Z"),
      sourceRecordKey: candidate.sourceRecordKey,
      targetType: "PLACE_REVIEW",
    },
    existingReview: { id: "review-1", updatedAt: new Date("2026-08-01T00:00:00.000Z"), rating: 4 },
    action: "UPDATE",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.action, "UPDATE");
  assert.equal(reviews.length, 0);
}

{
  const { result } = await runCase({
    reviewLineage: null,
    existingReview: { id: "dup-1", updatedAt: new Date("2026-08-01T00:00:00.000Z"), rating: 5 },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errorCode, "REVIEW_DUPLICATE_SOURCE");
}

console.log("ReviewCommitRunner tests: OK");
}

void main();
