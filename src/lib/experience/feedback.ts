/** Shared experience feedback contract (public form and server). */
export const MAX_EXPERIENCE_FEEDBACK_COMMENT_LENGTH = 2000;

export type ExperienceFeedbackSentiment = "LIKE" | "NEUTRAL" | "DISLIKE";

export function normalizeExperienceFeedbackComment(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

/** Retries are idempotent only for exactly the same recorded feedback. */
export function isSameExperienceFeedback(
  saved: { feedbackSentiment: ExperienceFeedbackSentiment | null; feedbackComment: string | null },
  requested: { sentiment: ExperienceFeedbackSentiment; comment: string | null },
): boolean {
  return saved.feedbackSentiment === requested.sentiment && saved.feedbackComment === requested.comment;
}
