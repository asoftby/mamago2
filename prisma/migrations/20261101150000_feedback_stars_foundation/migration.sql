-- Feedback 5★ foundation (ТЗ «Рейтинги mamaGo 2.0 — Feedback 5★», раздел 4).
-- Applies after 20261017151000_feedback_place_visit_venue_snapshot.
--
-- Evolves Feedback 1.0 to a 1–5 star scale without converting existing
-- −1/0/+1 reactions: they are kept and marked SENTIMENT3, star aggregates read
-- only STARS5. The aggregate table has no writer in the codebase; the migration
-- aborts if it unexpectedly contains rows instead of dropping data.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE "FeedbackScale" AS ENUM ('SENTIMENT3', 'STARS5');
CREATE TYPE "FeedbackExperienceLevel" AS ENUM ('TRIAL', 'REGULAR');
CREATE TYPE "FeedbackRevisionReason" AS ENUM ('USER_EDIT', 'MODERATION', 'MIGRATION');
CREATE TYPE "FeedbackProjection" AS ENUM ('DIRECT', 'LINKED_EVENT', 'LINKED_OFFER', 'BUSINESS_ROLLUP');

-- BUSINESS is aggregate-only (performer rollup). The new value must not be
-- referenced in this transaction, so the guard below compares as text.
ALTER TYPE "FeedbackTargetType" ADD VALUE 'BUSINESS';

-- ---------------------------------------------------------------------------
-- FeedbackReaction
-- ---------------------------------------------------------------------------
-- Existing rows are sentiment reactions (−1/0/+1); new rows default to stars.
ALTER TABLE "FeedbackReaction" ADD COLUMN "scale" "FeedbackScale" NOT NULL DEFAULT 'SENTIMENT3';
ALTER TABLE "FeedbackReaction" ALTER COLUMN "scale" SET DEFAULT 'STARS5';

ALTER TABLE "FeedbackReaction" DROP CONSTRAINT "FeedbackReaction_value_check";
ALTER TABLE "FeedbackReaction" ADD CONSTRAINT "FeedbackReaction_value_check" CHECK (
  ("scale" = 'SENTIMENT3' AND "value" IN (-1, 0, 1))
  OR ("scale" = 'STARS5' AND "value" BETWEEN 1 AND 5)
);
ALTER TABLE "FeedbackReaction" ADD CONSTRAINT "FeedbackReaction_target_not_business_check"
  CHECK ("targetType"::text <> 'BUSINESS');

ALTER TABLE "FeedbackReaction"
  ADD COLUMN "activitySessionId" TEXT,
  ADD COLUMN "offerSessionId" TEXT,
  ADD COLUMN "bookingRequestId" TEXT,
  ADD COLUMN "experienceLevel" "FeedbackExperienceLevel",
  ADD COLUMN "withdrawnAt" TIMESTAMP(3);

-- Canonical prefixed occurrence keys: plan:<PlanItem.id>, session:<id>,
-- offer-session:<id>, booking:<id>, visit:<YYYY-MM-DD>, legacy:<id>.
-- The only existing writer (My Plan) stored a bare PlanItem.id.
UPDATE "FeedbackReaction"
SET "occurrenceKey" = 'plan:' || "occurrenceKey"
WHERE "source" = 'PLAN' AND "occurrenceKey" <> '' AND position(':' in "occurrenceKey") = 0;

DROP INDEX "FeedbackReaction_actorKey_targetType_targetId_occurrenceKey_key";
CREATE UNIQUE INDEX "FeedbackReaction_actorKey_targetType_targetId_occurrenceKey_scale_key"
  ON "FeedbackReaction"("actorKey", "targetType", "targetId", "occurrenceKey", "scale");

CREATE INDEX "FeedbackReaction_targetType_targetId_scale_isPublicEligible_idx"
  ON "FeedbackReaction"("targetType", "targetId", "scale", "isPublicEligible");
CREATE INDEX "FeedbackReaction_activitySessionId_idx" ON "FeedbackReaction"("activitySessionId");
CREATE INDEX "FeedbackReaction_offerSessionId_idx" ON "FeedbackReaction"("offerSessionId");
CREATE INDEX "FeedbackReaction_bookingRequestId_idx" ON "FeedbackReaction"("bookingRequestId");

ALTER TABLE "FeedbackReaction"
  ADD CONSTRAINT "FeedbackReaction_activitySessionId_fkey"
  FOREIGN KEY ("activitySessionId") REFERENCES "ActivitySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedbackReaction"
  ADD CONSTRAINT "FeedbackReaction_offerSessionId_fkey"
  FOREIGN KEY ("offerSessionId") REFERENCES "OfferSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedbackReaction"
  ADD CONSTRAINT "FeedbackReaction_bookingRequestId_fkey"
  FOREIGN KEY ("bookingRequestId") REFERENCES "BookingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- FeedbackReview: keep the last published version visible during re-moderation
-- ---------------------------------------------------------------------------
ALTER TABLE "FeedbackReview"
  ADD COLUMN "publishedText" TEXT,
  ADD COLUMN "publishedAt" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- FeedbackRevision: history of every reaction/review change
-- ---------------------------------------------------------------------------
CREATE TABLE "FeedbackRevision" (
    "id" TEXT NOT NULL,
    "reactionId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "scale" "FeedbackScale" NOT NULL,
    "tagIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "reviewText" TEXT,
    "reviewStatus" "FeedbackReviewStatus",
    "reason" "FeedbackRevisionReason" NOT NULL,
    "actorKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedbackRevision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FeedbackRevision_reactionId_createdAt_idx" ON "FeedbackRevision"("reactionId", "createdAt");
ALTER TABLE "FeedbackRevision"
  ADD CONSTRAINT "FeedbackRevision_reactionId_fkey"
  FOREIGN KEY ("reactionId") REFERENCES "FeedbackReaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- FeedbackTag: showFor moves to star values; party category chip sets
-- ---------------------------------------------------------------------------
ALTER TABLE "FeedbackTag" DROP CONSTRAINT "FeedbackTag_showFor_check";
-- Every existing row is sentiment-valued (the dropped CHECK enforced −1/0/+1),
-- so all rows convert. Per value: 1 → {4,5}, 0 → {3}, −1 → {1,2}; hence
-- [1] → [4,5], [1,0] → [3,4,5], [-1,0] → [1,2,3] (src/lib/feedback/tagCatalog.ts).
UPDATE "FeedbackTag"
SET "showFor" = ARRAY(
  SELECT DISTINCT s
  FROM unnest("showFor") AS v
  CROSS JOIN LATERAL unnest(
    CASE v WHEN 1 THEN ARRAY[4,5] WHEN 0 THEN ARRAY[3] WHEN -1 THEN ARRAY[1,2] ELSE ARRAY[]::INTEGER[] END
  ) AS s
  ORDER BY s
);
ALTER TABLE "FeedbackTag" ADD CONSTRAINT "FeedbackTag_showFor_check"
  CHECK ("showFor" <@ ARRAY[1,2,3,4,5]);
ALTER TABLE "FeedbackTag" ADD COLUMN "partyCategories" "PartyCategory"[] NOT NULL DEFAULT ARRAY[]::"PartyCategory"[];

-- ---------------------------------------------------------------------------
-- FeedbackReputationAggregate: rebuilt for stars and source projections
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "FeedbackReputationAggregate") THEN
    RAISE EXCEPTION 'FeedbackReputationAggregate is not empty; stop and reconcile before the 5-star migration';
  END IF;
END $$;
DROP TABLE "FeedbackReputationAggregate";

CREATE TABLE "FeedbackReputationAggregate" (
    "targetType" "FeedbackTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "projection" "FeedbackProjection" NOT NULL,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "ratingSum" INTEGER NOT NULL DEFAULT 0,
    "ratingAverage" DOUBLE PRECISION,
    "c1" INTEGER NOT NULL DEFAULT 0,
    "c2" INTEGER NOT NULL DEFAULT 0,
    "c3" INTEGER NOT NULL DEFAULT 0,
    "c4" INTEGER NOT NULL DEFAULT 0,
    "c5" INTEGER NOT NULL DEFAULT 0,
    "verifiedCount" INTEGER NOT NULL DEFAULT 0,
    "rankScore" DOUBLE PRECISION,
    "tagStats" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeedbackReputationAggregate_pkey" PRIMARY KEY ("targetType", "targetId", "projection"),
    CONSTRAINT "FeedbackReputationAggregate_counts_check" CHECK (
      "c1" >= 0 AND "c2" >= 0 AND "c3" >= 0 AND "c4" >= 0 AND "c5" >= 0
      AND "verifiedCount" >= 0 AND "verifiedCount" <= "ratingCount"
      AND "ratingCount" = "c1" + "c2" + "c3" + "c4" + "c5"
      AND "ratingSum" = "c1" + 2 * "c2" + 3 * "c3" + 4 * "c4" + 5 * "c5"
    )
);
CREATE INDEX "FeedbackReputationAggregate_projection_targetType_rankScore_idx"
  ON "FeedbackReputationAggregate"("projection", "targetType", "rankScore");
