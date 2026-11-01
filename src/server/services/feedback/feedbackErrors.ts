/** Domain errors of the Feedback 5★ write path, mapped 1:1 to HTTP statuses. */
export type FeedbackErrorCode =
  | "TARGET_NOT_FOUND"
  | "TARGET_NOT_RATEABLE"
  | "OFFER_INHERITS_PLACE"
  | "INVALID_VALUE"
  | "INVALID_OCCURRENCE"
  | "OCCURRENCE_NOT_FOUND"
  | "OCCURRENCE_NOT_STARTED"
  | "OCCURRENCE_NOT_ALLOWED"
  | "INVALID_TAG"
  | "EXPERIENCE_LEVEL_NOT_APPLICABLE"
  | "REACTION_NOT_FOUND"
  | "PHONE_NOT_VERIFIED"
  | "INVALID_REVIEW_TEXT"
  | "RATE_LIMITED";

const STATUS: Record<FeedbackErrorCode, number> = {
  TARGET_NOT_FOUND: 404,
  TARGET_NOT_RATEABLE: 422,
  OFFER_INHERITS_PLACE: 422,
  INVALID_VALUE: 400,
  INVALID_OCCURRENCE: 400,
  OCCURRENCE_NOT_FOUND: 404,
  OCCURRENCE_NOT_STARTED: 422,
  OCCURRENCE_NOT_ALLOWED: 422,
  INVALID_TAG: 422,
  EXPERIENCE_LEVEL_NOT_APPLICABLE: 422,
  REACTION_NOT_FOUND: 404,
  PHONE_NOT_VERIFIED: 403,
  INVALID_REVIEW_TEXT: 400,
  RATE_LIMITED: 429,
};

export class FeedbackDomainError extends Error {
  readonly status: number;
  constructor(readonly code: FeedbackErrorCode, message?: string) {
    super(message ?? code);
    this.name = "FeedbackDomainError";
    this.status = STATUS[code];
  }
}
