/**
 * A single private emoji reaction never requires a phone in Feedback v1.
 * Public text requires SMS verification, and legacy behavior is preserved
 * until the rollout flag is enabled.
 */
export function requiresVerifiedPhoneForPlanFeedback(input: {
  feedbackV1Enabled: boolean;
  comment?: string | null;
}): boolean {
  return !input.feedbackV1Enabled || Boolean(input.comment?.trim());
}
