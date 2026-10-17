-- Venue-at-visit is captured by a trusted feedback writer after verified
-- attendance or completed booking; existing rows remain NULL and are excluded
-- from linked public reputation until they can be independently verified.
ALTER TABLE "FeedbackReaction" ADD COLUMN "venuePlaceIdAtVisit" TEXT;

CREATE INDEX "FeedbackReaction_targetType_venuePlaceIdAtVisit_isPublicEligible_idx"
ON "FeedbackReaction"("targetType", "venuePlaceIdAtVisit", "isPublicEligible");
