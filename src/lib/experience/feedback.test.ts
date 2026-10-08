import assert from "node:assert/strict";
import {
  MAX_EXPERIENCE_FEEDBACK_COMMENT_LENGTH,
  isSameExperienceFeedback,
  normalizeExperienceFeedbackComment,
} from "./feedback";

assert.equal(MAX_EXPERIENCE_FEEDBACK_COMMENT_LENGTH, 2000);
assert.equal(normalizeExperienceFeedbackComment(undefined), null);
assert.equal(normalizeExperienceFeedbackComment(null), null);
assert.equal(normalizeExperienceFeedbackComment(" \n "), null);
assert.equal(normalizeExperienceFeedbackComment("  Всё понравилось!  "), "Всё понравилось!");

const saved = { feedbackSentiment: "LIKE" as const, feedbackComment: "Хорошо" };
assert.equal(isSameExperienceFeedback(saved, { sentiment: "LIKE", comment: "Хорошо" }), true);
assert.equal(isSameExperienceFeedback(saved, { sentiment: "LIKE", comment: "Другое" }), false);
assert.equal(isSameExperienceFeedback(saved, { sentiment: "DISLIKE", comment: "Хорошо" }), false);
assert.equal(isSameExperienceFeedback({ feedbackSentiment: null, feedbackComment: null }, { sentiment: "LIKE", comment: null }), false);
console.log("✅ experience feedback contract");
