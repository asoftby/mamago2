-- Additive index for proven venue linkage queries in Feedback place reputation.
-- Applies after 20261017130000_feedback_v1_foundation.
CREATE INDEX "FeedbackReaction_targetType_occurrenceKey_isPublicEligible_idx"
ON "FeedbackReaction"("targetType", "occurrenceKey", "isPublicEligible");
