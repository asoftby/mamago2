-- Feedback v1 foundation: additive-only. Existing review, Experience and rating
-- tables are intentionally untouched until a separately approved backfill.
CREATE TYPE "FeedbackTargetType" AS ENUM ('EVENT', 'PLACE', 'OFFER', 'ARTICLE', 'NEWS', 'ROUTE');
CREATE TYPE "FeedbackSource" AS ENUM ('PLAN', 'CARD', 'PUSH', 'ARTICLE', 'MIGRATION');
CREATE TYPE "FeedbackVisitStatus" AS ENUM ('NONE', 'SELF_REPORTED', 'VERIFIED');
CREATE TYPE "FeedbackReviewStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED');
CREATE TYPE "FeedbackTagScope" AS ENUM ('PROGRAM', 'VENUE', 'ORGANIZER');

CREATE TABLE "FeedbackReaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "actorKey" TEXT NOT NULL,
    "familyId" TEXT,
    "targetType" "FeedbackTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "occurrenceKey" TEXT NOT NULL DEFAULT '',
    "value" INTEGER NOT NULL,
    "tagIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "visitStatus" "FeedbackVisitStatus" NOT NULL DEFAULT 'NONE',
    "visitedAt" TIMESTAMP(3),
    "isPublicEligible" BOOLEAN NOT NULL DEFAULT false,
    "source" "FeedbackSource" NOT NULL,
    "originalRating" INTEGER,
    "migrationKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeedbackReaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FeedbackReaction_value_check" CHECK ("value" IN (-1, 0, 1))
);

CREATE UNIQUE INDEX "FeedbackReaction_actorKey_targetType_targetId_occurrenceKey_key"
    ON "FeedbackReaction"("actorKey", "targetType", "targetId", "occurrenceKey");
CREATE UNIQUE INDEX "FeedbackReaction_migrationKey_key" ON "FeedbackReaction"("migrationKey");
CREATE INDEX "FeedbackReaction_targetType_targetId_isPublicEligible_idx"
    ON "FeedbackReaction"("targetType", "targetId", "isPublicEligible");
CREATE INDEX "FeedbackReaction_userId_createdAt_idx" ON "FeedbackReaction"("userId", "createdAt");
CREATE INDEX "FeedbackReaction_familyId_createdAt_idx" ON "FeedbackReaction"("familyId", "createdAt");
CREATE INDEX "FeedbackReaction_source_idx" ON "FeedbackReaction"("source");

ALTER TABLE "FeedbackReaction"
    ADD CONSTRAINT "FeedbackReaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FeedbackReview" (
    "id" TEXT NOT NULL,
    "reactionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "FeedbackReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "phoneVerifiedAt" TIMESTAMP(3),
    "moderatedById" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "businessReply" TEXT,
    "businessReplyStatus" "FeedbackReviewStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeedbackReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeedbackReview_reactionId_key" ON "FeedbackReview"("reactionId");
CREATE INDEX "FeedbackReview_status_createdAt_idx" ON "FeedbackReview"("status", "createdAt");
ALTER TABLE "FeedbackReview"
    ADD CONSTRAINT "FeedbackReview_reactionId_fkey"
    FOREIGN KEY ("reactionId") REFERENCES "FeedbackReaction"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FeedbackTag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "scope" "FeedbackTagScope" NOT NULL,
    "showFor" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "targetTypes" "FeedbackTargetType"[] NOT NULL DEFAULT ARRAY[]::"FeedbackTargetType"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeedbackTag_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FeedbackTag_showFor_check" CHECK ("showFor" <@ ARRAY[-1,0,1])
);

CREATE UNIQUE INDEX "FeedbackTag_key_key" ON "FeedbackTag"("key");
CREATE INDEX "FeedbackTag_scope_isActive_idx" ON "FeedbackTag"("scope", "isActive");

CREATE TABLE "FeedbackReputationAggregate" (
    "targetType" "FeedbackTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "countPos" INTEGER NOT NULL DEFAULT 0,
    "countNeu" INTEGER NOT NULL DEFAULT 0,
    "countNeg" INTEGER NOT NULL DEFAULT 0,
    "sharePositive" DOUBLE PRECISION,
    "rankScore" DOUBLE PRECISION,
    "topTags" JSONB,
    "linkedTags" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeedbackReputationAggregate_pkey" PRIMARY KEY ("targetType","targetId"),
    CONSTRAINT "FeedbackReputationAggregate_counts_check" CHECK (
      "count" >= 0 AND "countPos" >= 0 AND "countNeu" >= 0 AND "countNeg" >= 0
      AND "count" = "countPos" + "countNeu" + "countNeg"
    )
);
